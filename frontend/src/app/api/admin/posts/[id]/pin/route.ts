import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticate } from '@/lib/auth-server';
import { formatPost, postInclude } from '@/lib/posts-db';
import { invalidatePostCache, invalidateUserCache } from '@/lib/cache';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authUser = await authenticate(req);
    if (authUser.role !== 'ADMIN') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    const { id } = await params;

    const post = await prisma.post.findUnique({ where: { id } });
    if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });

    let action: string;
    if (post.pinned) {
      await prisma.post.update({ where: { id }, data: { pinned: false } });
      action = 'unpinned';
    } else {
      // Unpin any existing pinned post by this user first
      await prisma.post.updateMany({ where: { userId: post.userId, pinned: true }, data: { pinned: false } });
      await prisma.post.update({ where: { id }, data: { pinned: true } });
      action = 'pinned';
    }

    const updated = await prisma.post.findUnique({ where: { id }, include: postInclude });
    
    await invalidatePostCache(id);
    if (updated?.user.username) {
      await invalidateUserCache(updated.user.username);
    }

    return NextResponse.json({ action, post: formatPost(updated!) });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
