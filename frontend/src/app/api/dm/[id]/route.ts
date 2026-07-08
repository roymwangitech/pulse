import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { authenticate } from '@/lib/auth-server';

const sendSchema = z.object({
  content: z.string().min(1).max(3000),
  replyToId: z.string().optional(),
});

const msgSelect = {
  id: true,
  content: true,
  senderId: true,
  readAt: true,
  createdAt: true,
  replyToId: true,
  replyTo: { select: { id: true, content: true, senderId: true } },
} as const;

async function pruneOldMessages(conversationId: string) {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  await prisma.directMessage.deleteMany({
    where: { conversationId, createdAt: { lt: cutoff } },
  });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await authenticate(req);
    const { id } = await params;

    const conv = await prisma.conversation.findUnique({ where: { id } });
    if (!conv) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    if (conv.userAId !== me.userId && conv.userBId !== me.userId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    pruneOldMessages(id).catch(() => {});

    const { searchParams } = new URL(req.url);
    const cursor = searchParams.get('cursor') ?? undefined;
    const limit = 30;

    const messages = await prisma.directMessage.findMany({
      where: {
        conversationId: id,
        ...(conv.userAId === me.userId ? { deletedBySender: false } : { deletedByReceiver: false }),
      },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      select: msgSelect,
    });

    await prisma.directMessage.updateMany({
      where: { conversationId: id, senderId: { not: me.userId }, readAt: null },
      data: { readAt: new Date() },
    });

    const hasMore = messages.length > limit;
    const items = hasMore ? messages.slice(0, limit) : messages;

    return NextResponse.json({
      messages: items.map((m: typeof items[number]) => ({ ...m, fromMe: m.senderId === me.userId })).reverse(),
      nextCursor: hasMore ? items[items.length - 1].id : null,
      hasMore,
    });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await authenticate(req);
    const { id } = await params;
    const body = await req.json();
    const parsed = sendSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Validation failed' }, { status: 400 });

    const conv = await prisma.conversation.findUnique({ where: { id } });
    if (!conv) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    if (conv.userAId !== me.userId && conv.userBId !== me.userId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const [message] = await prisma.$transaction([
      prisma.directMessage.create({
        data: {
          conversationId: id,
          senderId: me.userId,
          content: parsed.data.content.trim(),
          replyToId: parsed.data.replyToId ?? null,
        },
        select: msgSelect,
      }),
      prisma.conversation.update({ where: { id }, data: { updatedAt: new Date() } }),
    ]);

    return NextResponse.json({ message: { ...message, fromMe: true } }, { status: 201 });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
