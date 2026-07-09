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
  imageUrl: string | null;
  depth: number;
  createdAt: Date;
  user: { id: string; username: string; displayName: string | null; avatarUrl: string };
  reactions: { emoji: string; userId: string }[];
  _count?: { childReplies: number };
}) {
  const reactionMap = new Map<string, { emoji: string; count: number; userIds: string[] }>();
  for (const r of reply.reactions) {
    const existing = reactionMap.get(r.emoji);
    if (existing) {
      existing.count++;
      existing.userIds.push(r.userId);
    } else {
      reactionMap.set(r.emoji, { emoji: r.emoji, count: 1, userIds: [r.userId] });
    }
  }

  return {
    id: reply.id,
    postId: reply.postId,
    parentReplyId: reply.parentReplyId,
    content: reply.content,
    imageUrl: reply.imageUrl ?? null,
    depth: reply.depth,
    createdAt: reply.createdAt,
    user: reply.user,
    reactions: Array.from(reactionMap.values()),
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
  const { content, imageUrl, parentReplyId } = req.body as { content?: string; imageUrl?: string; parentReplyId?: string };
  const trimmedContent = content?.trim() || '';

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
      imageUrl: imageUrl || null,
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
