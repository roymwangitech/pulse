import { Router, Response } from 'express';
import { paramId } from '../lib/params.js';
import { prisma } from '../lib/prisma.js';
import { generateAvatarUrl, generateAvatarSeed } from '../lib/avatar.js';
import { sanitizeUser } from '../lib/auth.js';
import { formatPost, postInclude } from '../lib/posts.js';
import { authenticate, optionalAuth, AuthRequest } from '../middleware/auth.js';

const router = Router();

router.get('/:username', optionalAuth, async (req, res) => {
  const username = paramId(req.params.username).toLowerCase();
  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      role: true,
      status: true,
      createdAt: true,
      _count: { select: { posts: true, threadReplies: true } },
    },
  });

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json({
    user: {
      ...sanitizeUser(user),
      postCount: user._count.posts,
      replyCount: user._count.threadReplies,
    },
  });
});

router.get('/:username/posts', optionalAuth, async (req, res) => {
  const username = paramId(req.params.username).toLowerCase();
  const user = await prisma.user.findUnique({
    where: { username },
  });
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const cursor = req.query.cursor as string | undefined;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);

  const posts = await prisma.post.findMany({
    where: { userId: user.id },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: { createdAt: 'desc' },
    include: postInclude,
  });

  const hasMore = posts.length > limit;
  const items = hasMore ? posts.slice(0, limit) : posts;

  res.json({
    posts: items.map(formatPost),
    nextCursor: hasMore ? items[items.length - 1].id : null,
    hasMore,
  });
});

router.post('/avatar/regenerate', authenticate, async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const seed = generateAvatarSeed();
  const avatarUrl = generateAvatarUrl(user.username, seed);

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { avatarUrl },
  });

  res.json({ avatarUrl: updated.avatarUrl });
});

router.patch('/profile', authenticate, async (req: AuthRequest, res: Response) => {
  const { displayName } = req.body;
  if (!displayName || typeof displayName !== 'string' || displayName.length > 50) {
    res.status(400).json({ error: 'Invalid display name' });
    return;
  }

  const user = await prisma.user.update({
    where: { id: req.user!.userId },
    data: { displayName },
  });

  res.json({ user: sanitizeUser(user) });
});

export default router;
