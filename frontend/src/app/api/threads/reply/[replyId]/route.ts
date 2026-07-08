import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { authenticate } from '@/lib/auth-server';

const editSchema = z.object({ content: z.string().min(1).max(2000) });

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ replyId: string }> }) {
  try {
    const user = await authenticate(req);
    const { replyId } = await params;
    const body = await req.json();
    const parsed = editSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Validation failed' }, { status: 400 });

    const reply = await prisma.threadReply.findUnique({ where: { id: replyId } });
    if (!reply) return NextResponse.json({ error: 'Reply not found' }, { status: 404 });
    if (reply.userId !== user.userId) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });

    const updated = await prisma.threadReply.update({
      where: { id: replyId },
      data: { content: parsed.data.content.trim() },
      include: {
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        reactions: true,
        _count: { select: { childReplies: true } },
      },
    });

    const reactionMap = new Map<string, number>();
    for (const r of updated.reactions) reactionMap.set(r.emoji, (reactionMap.get(r.emoji) ?? 0) + 1);

    return NextResponse.json({
      reply: {
        id: updated.id, postId: updated.postId, parentReplyId: updated.parentReplyId,
        content: updated.content, depth: updated.depth, createdAt: updated.createdAt,
        editedAt: updated.updatedAt,
        imageUrl: updated.imageUrl ?? null,
        user: updated.user,
        reactions: Array.from(reactionMap.entries()).map(([emoji, count]) => ({ emoji, count })),
        childCount: updated._count.childReplies,
      },
    });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ replyId: string }> }) {
  try {
    const user = await authenticate(req);
    const { replyId } = await params;

    const reply = await prisma.threadReply.findUnique({ where: { id: replyId } });
    if (!reply) return NextResponse.json({ error: 'Reply not found' }, { status: 404 });
    if (reply.userId !== user.userId && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    await prisma.threadReply.delete({ where: { id: replyId } });
    return NextResponse.json({ message: 'Reply deleted' });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
