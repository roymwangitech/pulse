import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticate } from '@/lib/auth-server';
import { formatPost, postInclude } from '@/lib/posts-db';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await authenticate(req);
    const { id } = await params;

    const post = await prisma.post.findUnique({ where: { id }, include: postInclude });
    if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    if (post.userId !== user.userId) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });

    let action: string;
    let updatedPost;

    if (post.pinned) {
      updatedPost = await prisma.post.update({
        where: { id },
        data: { pinned: false },
        include: postInclude,
      });
      action = 'unpinned';
    } else {
      // Unpin all other posts of this user first
      await prisma.post.updateMany({
        where: { userId: user.userId, pinned: true },
        data: { pinned: false },
      });
      updatedPost = await prisma.post.update({
        where: { id },
        data: { pinned: true },
        include: postInclude,
      });
      action = 'pinned';
    }

    return NextResponse.json({ action, post: formatPost(updatedPost) });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
