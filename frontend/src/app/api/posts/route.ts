import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { authenticate, optionalAuth } from '@/lib/auth-server';
import { formatPost, postInclude, buildSearchText, extractHashtags, getDateRangeFilter } from '@/lib/posts-db';
import { getCache, setCache } from '@/lib/redis';
import { invalidateFeedCache, invalidateUserCache, invalidateSearchCache } from '@/lib/cache';

const feedSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(50).default(20),
  filter: z.enum(['all', 'today', '7days', '30days', 'year', 'custom']).default('all'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

const createSchema = z.object({
  caption: z.string().max(3000),
  imageUrl: z.string().url().optional(),
});

async function syncHashtags(postId: string, caption: string) {
  const tags = extractHashtags(caption);
  for (const name of tags) {
    const hashtag = await prisma.hashtag.upsert({ where: { name }, create: { name }, update: {} });
    await prisma.postHashtag.upsert({
      where: { postId_hashtagId: { postId, hashtagId: hashtag.id } },
      create: { postId, hashtagId: hashtag.id },
      update: {},
    });
  }
}

export async function GET(req: NextRequest) {
  try {
    optionalAuth(req);
    const { searchParams } = new URL(req.url);
    const parsed = feedSchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) return NextResponse.json({ error: 'Validation failed' }, { status: 400 });

    const { cursor, limit, filter, startDate, endDate } = parsed.data;
    const cacheKey = `feed:posts:${cursor ?? ''}:${limit}:${filter}:${startDate ?? ''}:${endDate ?? ''}`;
    const cached = await getCache<unknown>(cacheKey);
    if (cached) return NextResponse.json(cached);

    const dateFilter = filter !== 'all' ? getDateRangeFilter(filter, startDate, endDate) : {};

    const posts = await prisma.post.findMany({
      where: { createdAt: dateFilter },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      include: postInclude,
    });

    const hasMore = posts.length > limit;
    const items = hasMore ? posts.slice(0, limit) : posts;

    const result = {
      posts: items.map(formatPost),
      nextCursor: hasMore ? items[items.length - 1].id : null,
      hasMore,
    };

    await setCache(cacheKey, result, 300);
    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'public, max-age=10, s-maxage=30, stale-while-revalidate=30',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await authenticate(req);
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Validation failed' }, { status: 400 });

    const { caption: rawCaption, imageUrl } = parsed.data;
    const caption = rawCaption.trim();
    const dbUser = await prisma.user.findUnique({ where: { id: user.userId } });
    if (dbUser?.postingBlocked) return NextResponse.json({ error: 'You have been blocked from posting' }, { status: 403 });
    const searchText = buildSearchText(caption, dbUser?.username);

    const post = await prisma.post.create({
      data: { userId: user.userId, caption, searchText, imageUrl: imageUrl ?? null },
      include: postInclude,
    });

    await syncHashtags(post.id, caption);

    await invalidateFeedCache();
    if (dbUser?.username) {
      await invalidateUserCache(dbUser.username);
    }
    await invalidateSearchCache();

    return NextResponse.json({ post: formatPost(post) }, { status: 201 });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
