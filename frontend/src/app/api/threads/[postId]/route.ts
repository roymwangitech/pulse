import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { authenticate } from '@/lib/auth-server';
import { calculateReplyDepth } from '@/lib/posts-db';

function formatReply(reply: {
  id: string; postId: string; parentReplyId: string | null;
  content: string; depth: number; createdAt: Date;
  user: { id: string; username: string; displayName: string | null; avatarUrl: string };
  reactions: { emoji: string; userId: string }[];
  _count?: { childReplies: number };
}) {
  const reactionMap = new Map<string, number>();
  for (const r of reply.reactions) reactionMap.set(r.emoji, (reactionMap.get(r.emoji) ?? 0) + 1);
  return {
    id: reply.id, postId: reply.postId, parentReplyId: reply.parentReplyId,
    content: reply.content, depth: reply.depth, createdAt: reply.createdAt,
    user: reply.user,
    reactions: Array.from(reactionMap.entries()).map(([emoji, count]) => ({ emoji, count })),
    childCount: reply._count?.childReplies ?? 0,
  };
}

const replyInclude = {
  user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
  reactions: true,
  _count: { select: { childReplies: true } },
};

const querySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(50).default(15),
  parentReplyId: z.string().optional(),
});

const createSchema = z.object({
  content: z.string().min(1).max(500),
  parentReplyId: z.string().optional(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ postId: string }> }) {
  try {
    const { postId } = await params;
    const { searchParams } = new URL(req.url);
    const parsed = querySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) return NextResponse.json({ error: 'Validation failed' }, { status: 400 });

    const { cursor, limit, parentReplyId } = parsed.data;
    const where = { postId, parentReplyId: parentReplyId ?? null };

    const [replies, total] = await Promise.all([
      prisma.threadReply.findMany({
        where, take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: { createdAt: 'asc' },
        include: replyInclude,
      }),
      prisma.threadReply.count({ where }),
    ]);

    const hasMore = replies.length > limit;
    const items = hasMore ? replies.slice(0, limit) : replies;
    return NextResponse.json({
      replies: items.map(formatReply),
      nextCursor: hasMore ? items[items.length - 1].id : null,
      hasMore, total,
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ postId: string }> }) {
  try {
    const authUser = await authenticate(req);
    const { postId } = await params;
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Validation failed' }, { status: 400 });

    const { content, parentReplyId } = parsed.data;
    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });

    let depth = 0;
    if (parentReplyId) {
      const parent = await prisma.threadReply.findUnique({ where: { id: parentReplyId } });
      if (!parent || parent.postId !== postId) return NextResponse.json({ error: 'Invalid parent reply' }, { status: 400 });
      try { depth = calculateReplyDepth(parent.depth); }
      catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }
    }

    const reply = await prisma.threadReply.create({
      data: { postId, parentReplyId: parentReplyId ?? undefined, userId: authUser.userId, content: content.trim(), depth },
      include: replyInclude,
    });

    return NextResponse.json({ reply: formatReply(reply) }, { status: 201 });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
