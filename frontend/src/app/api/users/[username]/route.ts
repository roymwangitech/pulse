import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sanitizeUser } from '@/lib/auth-server';
import { getCache, setCache } from '@/lib/redis';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  try {
    const { username } = await params;
    const norm = username.toLowerCase();
    const cacheKey = `user:profile:${norm}`;

    const cached = await getCache<unknown>(cacheKey);
    if (cached) return NextResponse.json(cached);

    const user = await prisma.user.findUnique({
      where: { username: norm },
      select: {
        id: true, username: true, displayName: true, avatarUrl: true,
        role: true, status: true, postingBlocked: true, createdAt: true,
        _count: { select: { posts: true, threadReplies: true } },
      },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const result = {
      user: { ...sanitizeUser(user), postCount: user._count.posts, replyCount: user._count.threadReplies },
    };

    await setCache(cacheKey, result, 600);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
