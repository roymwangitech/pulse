import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { formatPost, postInclude } from '@/lib/posts-db';

export async function GET(req: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  try {
    const { username } = await params;
    const user = await prisma.user.findUnique({ where: { username: username.toLowerCase() } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { searchParams } = new URL(req.url);
    const cursor = searchParams.get('cursor') ?? undefined;
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 50);

    const posts = await prisma.post.findMany({
      where: { userId: user.id }, take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' }, include: postInclude,
    });

    const hasMore = posts.length > limit;
    const items = hasMore ? posts.slice(0, limit) : posts;
    return NextResponse.json({ posts: items.map(formatPost), nextCursor: hasMore ? items[items.length - 1].id : null, hasMore });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
