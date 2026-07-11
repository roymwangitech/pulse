import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCache, setCache } from '@/lib/redis';

export async function GET() {
  try {
    const cacheKey = 'search:trending';
    const cached = await getCache<{ hashtags: { name: string; postCount: number }[] }>(cacheKey);
    if (cached) return NextResponse.json(cached);

    const hashtags = await prisma.hashtag.findMany({
      take: 10,
      orderBy: { posts: { _count: 'desc' } },
      select: {
        name: true,
        _count: { select: { posts: true } },
      },
    });

    const result = {
      hashtags: hashtags.map((h) => ({ name: h.name, postCount: h._count.posts })),
    };

    await setCache(cacheKey, result, 300);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
