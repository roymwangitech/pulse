import { Router, Response } from 'express';
import { paramId } from '../lib/params.js';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { banUserSchema } from '../validators/schemas.js';

const router = Router();

router.use(authenticate, requireAdmin);

router.get('/analytics', async (_req, res) => {
  const [userCount, postCount, replyCount, reactionCount, activeToday] = await Promise.all([
    prisma.user.count(),
    prisma.post.count(),
    prisma.threadReply.count(),
    prisma.reaction.count(),
    prisma.post.count({
      where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    }),
  ]);

  res.json({
    analytics: { userCount, postCount, replyCount, reactionCount, postsToday: activeToday },
  });
});

router.get('/users', async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = 20;
  const skip = (page - 1) * limit;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        role: true,
        status: true,
        createdAt: true,
        _count: { select: { posts: true } },
      },
    }),
    prisma.user.count(),
  ]);

  res.json({ users, total, page, totalPages: Math.ceil(total / limit) });
});

router.get('/posts', async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = 20;
  const skip = (page - 1) * limit;

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        _count: { select: { replies: true, reactions: true } },
      },
    }),
    prisma.post.count(),
  ]);

  res.json({ posts, total, page, totalPages: Math.ceil(total / limit) });
});

router.delete('/posts/:id', async (req, res) => {
  const id = paramId(req.params.id);
  await prisma.post.delete({ where: { id } });
  const io = req.app.get('io');
  io?.emit('post:deleted', { postId: id });
  res.json({ message: 'Post deleted' });
});

router.post('/users/:id/ban', validateBody(banUserSchema), async (req: AuthRequest, res: Response) => {
  const id = paramId(req.params.id);
  const user = await prisma.user.update({
    where: { id },
    data: { status: 'BANNED' },
  });
  res.json({ user: { id: user.id, status: user.status } });
});

router.post('/users/:id/unban', async (req, res) => {
  const id = paramId(req.params.id);
  const user = await prisma.user.update({
    where: { id },
    data: { status: 'ACTIVE' },
  });
  res.json({ user: { id: user.id, status: user.status } });
});

export default router;
