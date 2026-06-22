import { Router, Response } from 'express';
import { paramId } from '../lib/params.js';
import { prisma } from '../lib/prisma.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { reactionSchema } from '../validators/schemas.js';

const router = Router();

router.post('/posts/:postId', authenticate, validateBody(reactionSchema), async (req: AuthRequest, res: Response) => {
  const postId = paramId(req.params.postId);
  const { emoji } = req.body;

  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) {
    res.status(404).json({ error: 'Post not found' });
    return;
  }

  const existing = await prisma.reaction.findUnique({
    where: { userId_postId_emoji: { userId: req.user!.userId, postId, emoji } },
  });

  if (existing) {
    await prisma.reaction.delete({ where: { id: existing.id } });
    const io = req.app.get('io');
    io?.emit('reaction:removed', { postId, emoji, userId: req.user!.userId });
    res.json({ action: 'removed', emoji });
    return;
  }

  const reaction = await prisma.reaction.create({
    data: { userId: req.user!.userId, postId, emoji },
  });

  const io = req.app.get('io');
  io?.emit('reaction:added', {
    postId,
    emoji,
    userId: req.user!.userId,
    reactionId: reaction.id,
  });

  res.status(201).json({ action: 'added', reaction });
});

router.post('/replies/:replyId', authenticate, validateBody(reactionSchema), async (req: AuthRequest, res: Response) => {
  const replyId = paramId(req.params.replyId);
  const { emoji } = req.body;

  const reply = await prisma.threadReply.findUnique({ where: { id: replyId } });
  if (!reply) {
    res.status(404).json({ error: 'Reply not found' });
    return;
  }

  const existing = await prisma.replyReaction.findUnique({
    where: { userId_replyId_emoji: { userId: req.user!.userId, replyId, emoji } },
  });

  if (existing) {
    await prisma.replyReaction.delete({ where: { id: existing.id } });
    const io = req.app.get('io');
    io?.emit('reply:reaction:removed', { replyId, emoji, userId: req.user!.userId });
    res.json({ action: 'removed', emoji });
    return;
  }

  const reaction = await prisma.replyReaction.create({
    data: { userId: req.user!.userId, replyId, emoji },
  });

  const io = req.app.get('io');
  io?.emit('reply:reaction:added', { replyId, emoji, userId: req.user!.userId });

  res.status(201).json({ action: 'added', reaction });
});

router.get('/posts/:postId', async (req, res) => {
  const postId = paramId(req.params.postId);
  const reactions = await prisma.reaction.groupBy({
    by: ['emoji'],
    where: { postId },
    _count: { emoji: true },
  });

  res.json({
    reactions: reactions.map((r) => ({ emoji: r.emoji, count: r._count.emoji })),
  });
});

export default router;
