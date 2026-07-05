import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { authenticate } from '@/lib/auth-server';
import { formatPost, postInclude, buildSearchText, extractHashtags } from '@/lib/posts-db';

const editSchema = z.object({ caption: z.string().min(1).max(500) });

async function syncHashtags(postId: string, caption: string) {
  // Remove old hashtag links then re-add
  await prisma.postHashtag.deleteMany({ where: { postId } });
  const tags = extractHashtags(caption);
  for (const name of tags) {
    const hashtag = await prisma.hashtag.upsert({ where: { name }, create: { name }, update: {} });
    await prisma.postHashtag.create({ data: { postId, hashtagId: hashtag.id } });
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const post = await prisma.post.findUnique({ where: { id }, include: postInclude });
    if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    return NextResponse.json({ post: formatPost(post) });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await authenticate(req);
    const { id } = await params;
    const post = await prisma.post.findUnique({ where: { id } });
    if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    if (post.userId !== user.userId && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }
    await prisma.post.delete({ where: { id } });
    return NextResponse.json({ message: 'Post deleted' });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await authenticate(req);
    const { id } = await params;
    const body = await req.json();
    const parsed = editSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Validation failed' }, { status: 400 });

    const post = await prisma.post.findUnique({ where: { id } });
    if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    if (post.userId !== user.userId) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });

    const caption = parsed.data.caption.trim();
    const searchText = buildSearchText(caption, user.username);

    const updated = await prisma.post.update({
      where: { id },
      data: { caption, searchText },
      include: postInclude,
    });

    await syncHashtags(id, caption);
    return NextResponse.json({ post: formatPost(updated) });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
