import { Router, Response } from 'express';
import { paramId } from '../lib/params.js';
import { prisma } from '../lib/prisma.js';
import { calculateReplyDepth } from '../lib/utils.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { createReplySchema, threadQuerySchema } from '../validators/schemas.js';

const router = Router();

function formatReply(reply: {
  id: string;
  postId: string;
  parentReplyId: string | null;
  content: string;
  depth: number;
  createdAt: Date;
  user: { id: string; username: string; displayName: string | null; avatarUrl: string };
  reactions: { emoji: string; userId: string }[];
  _count?: { childReplies: number };
}) {
  const reactionMap = new Map<string, number>();
  for (const r of reply.reactions) {
    reactionMap.set(r.emoji, (reactionMap.get(r.emoji) ?? 0) + 1);
  }

  return {
    id: reply.id,
    postId: reply.postId,
    parentReplyId: reply.parentReplyId,
    content: reply.content,
    depth: reply.depth,
    createdAt: reply.createdAt,
    user: reply.user,
    reactions: Array.from(reactionMap.entries()).map(([emoji, count]) => ({ emoji, count })),
    childCount: reply._count?.childReplies ?? 0,
  };
}

router.get('/:postId', validateQuery(threadQuerySchema), async (req, res) => {
  const postId = paramId(req.params.postId);
  const { cursor, limit, parentReplyId } = (req as typeof req & {
    validatedQuery: { cursor?: string; limit: number; parentReplyId?: string };
  }).validatedQuery;

  const where = {
    postId,
    parentReplyId: parentReplyId ?? null,
  };

  const [replies, total] = await Promise.all([
    prisma.threadReply.findMany({
      where,
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'asc' },
      include: {
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        reactions: true,
        _count: { select: { childReplies: true } },
      },
    }),
    prisma.threadReply.count({ where }),
  ]);

  const hasMore = replies.length > limit;
  const items = hasMore ? replies.slice(0, limit) : replies;

  res.json({
    replies: items.map(formatReply),
    nextCursor: hasMore ? items[items.length - 1].id : null,
    hasMore,
    total,
  });
});

router.post('/:postId', authenticate, validateBody(createReplySchema), async (req: AuthRequest, res: Response) => {
  const postId = paramId(req.params.postId);
  const { content, parentReplyId } = req.body as { content: string; parentReplyId?: string };
  const trimmedContent = content.trim();

  if (!trimmedContent) {
    res.status(400).json({ error: 'Reply must include a message' });
    return;
  }

  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) {
    res.status(404).json({ error: 'Post not found' });
    return;
  }

  let depth = 0;
  if (parentReplyId) {
    const parent = await prisma.threadReply.findUnique({ where: { id: parentReplyId } });
    if (!parent || parent.postId !== postId) {
      res.status(400).json({ error: 'Invalid parent reply' });
      return;
    }
    try {
      depth = calculateReplyDepth(parent.depth);
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
      return;
    }
  }

  const reply = await prisma.threadReply.create({
    data: {
      postId,
      parentReplyId: parentReplyId || undefined,
      userId: req.user!.userId,
      content: trimmedContent,
      depth,
    },
    include: {
      user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      reactions: true,
      _count: { select: { childReplies: true } },
    },
  });

  const formatted = formatReply(reply);
  const io = req.app.get('io');
  io?.to(`thread:${postId}`).emit('reply:new', formatted);
  io?.emit('thread:updated', { postId, replyCount: await prisma.threadReply.count({ where: { postId } }) });

  res.status(201).json({ reply: formatted });
});

export default router;
