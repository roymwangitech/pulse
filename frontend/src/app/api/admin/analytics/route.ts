import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticate } from '@/lib/auth-server';

export async function GET(req: NextRequest) {
  try {
    const user = await authenticate(req);
    if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

    const [userCount, postCount, replyCount, reactionCount, activeToday] = await Promise.all([
      prisma.user.count(), prisma.post.count(), prisma.threadReply.count(), prisma.reaction.count(),
      prisma.post.count({ where: { createdAt: { gte: new Date(Date.now() - 86400000) } } }),
    ]);

    return NextResponse.json({ analytics: { userCount, postCount, replyCount, reactionCount, postsToday: activeToday } });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
