import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { formatPost, postInclude } from '@/lib/posts-db';
import { getCache, setCache } from '@/lib/redis';

export async function GET(req: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  try {
    const { username } = await params;
    const norm = username.toLowerCase();
    const { searchParams } = new URL(req.url);
    const cursor = searchParams.get('cursor') ?? undefined;
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 50);

    const cacheKey = `user:posts:${norm}:${cursor ?? ''}:${limit}`;
    const cached = await getCache<unknown>(cacheKey);
    if (cached) return NextResponse.json(cached);

    const user = await prisma.user.findUnique({ where: { username: norm } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const posts = await prisma.post.findMany({
      where: { userId: user.id }, take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }], include: postInclude,
    });

    const hasMore = posts.length > limit;
    const items = hasMore ? posts.slice(0, limit) : posts;

    const result = {
      posts: items.map(formatPost),
      nextCursor: hasMore ? items[items.length - 1].id : null,
      hasMore,
    };

    await setCache(cacheKey, result, 300);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
