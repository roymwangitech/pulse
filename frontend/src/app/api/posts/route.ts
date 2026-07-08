import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { authenticate, optionalAuth } from '@/lib/auth-server';
import { formatPost, postInclude, buildSearchText, extractHashtags, getDateRangeFilter } from '@/lib/posts-db';

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

    return NextResponse.json({
      posts: items.map(formatPost),
      nextCursor: hasMore ? items[items.length - 1].id : null,
      hasMore,
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
    const searchText = buildSearchText(caption, dbUser?.username);

    const post = await prisma.post.create({
      data: { userId: user.userId, caption, searchText, imageUrl: imageUrl ?? null },
      include: postInclude,
    });

    await syncHashtags(post.id, caption);
    return NextResponse.json({ post: formatPost(post) }, { status: 201 });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
