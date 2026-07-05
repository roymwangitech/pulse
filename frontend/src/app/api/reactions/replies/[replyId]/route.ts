import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { authenticate } from '@/lib/auth-server';

const schema = z.object({ emoji: z.string().min(1).max(10) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ replyId: string }> }) {
  try {
    const user = await authenticate(req);
    const { replyId } = await params;
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Validation failed' }, { status: 400 });

    const { emoji } = parsed.data;
    const reply = await prisma.threadReply.findUnique({ where: { id: replyId } });
    if (!reply) return NextResponse.json({ error: 'Reply not found' }, { status: 404 });

    const existing = await prisma.replyReaction.findUnique({
      where: { userId_replyId_emoji: { userId: user.userId, replyId, emoji } },
    });

    if (existing) {
      await prisma.replyReaction.delete({ where: { id: existing.id } });
      return NextResponse.json({ action: 'removed', emoji });
    }

    const reaction = await prisma.replyReaction.create({ data: { userId: user.userId, replyId, emoji } });
    return NextResponse.json({ action: 'added', reaction }, { status: 201 });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
