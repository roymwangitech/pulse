import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticate } from '@/lib/auth-server';
import { invalidatePostCache, invalidateUserCache, invalidateSearchCache } from '@/lib/cache';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await authenticate(req);
    if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    const { id } = await params;
    const post = await prisma.post.findUnique({
      where: { id },
      include: { user: { select: { username: true } } }
    });
    if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    await prisma.post.delete({ where: { id } });

    await invalidatePostCache(id);
    await invalidateUserCache(post.user.username);
    await invalidateSearchCache();

    return NextResponse.json({ message: 'Post deleted' });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
