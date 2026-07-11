import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCache, setCache } from '@/lib/redis';

export async function GET() {
  try {
    const cacheKey = 'search:recent-threads';
    const cached = await getCache<{ threads: unknown[] }>(cacheKey);
    if (cached) return NextResponse.json(cached);

    const posts = await prisma.post.findMany({
      where: { replies: { some: {} } },
      take: 10,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        caption: true,
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        _count: { select: { replies: true } },
      },
    });

    const result = {
      threads: posts.map((p) => ({
        id: p.id,
        caption: p.caption,
        user: p.user,
        replyCount: p._count.replies,
      })),
    };

    await setCache(cacheKey, result, 120);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
