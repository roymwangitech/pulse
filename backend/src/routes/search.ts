import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { validateQuery } from '../middleware/validate.js';
import { searchQuerySchema } from '../validators/schemas.js';

const router = Router();

router.get('/', validateQuery(searchQuerySchema), async (req, res) => {
  const { q, type, limit } = (req as typeof req & { validatedQuery: { q: string; type: string; limit: number } }).validatedQuery;
  const query = q.trim().toLowerCase();

  const results: {
    users: unknown[];
    hashtags: unknown[];
    posts: unknown[];
  } = { users: [], hashtags: [], posts: [] };

  if (type === 'all' || type === 'users') {
    results.users = await prisma.user.findMany({
      where: {
        OR: [
          { username: { contains: query, mode: 'insensitive' } },
          { displayName: { contains: query, mode: 'insensitive' } },
        ],
        status: 'ACTIVE',
      },
      take: limit,
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
      },
    });
  }

  if (type === 'all' || type === 'hashtags') {
    const tag = query.startsWith('#') ? query.slice(1) : query;
    results.hashtags = await prisma.hashtag.findMany({
      where: { name: { contains: tag, mode: 'insensitive' } },
      take: limit,
      include: { _count: { select: { posts: true } } },
    });
  }

  if (type === 'all' || type === 'captions') {
    results.posts = await prisma.post.findMany({
      where: {
        OR: [
          { searchText: { contains: query, mode: 'insensitive' } },
          { caption: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        _count: { select: { replies: true } },
      },
    });
  }

  res.json(results);
});

router.get('/trending', async (_req, res) => {
  const hashtags = await prisma.hashtag.findMany({
    take: 10,
    orderBy: { posts: { _count: 'desc' } },
    include: { _count: { select: { posts: true } } },
  });

  res.json({
    hashtags: hashtags.map((h) => ({
      name: h.name,
      postCount: h._count.posts,
    })),
  });
});

router.get('/recent-threads', async (_req, res) => {
  const posts = await prisma.post.findMany({
    where: { replies: { some: {} } },
    take: 10,
    orderBy: { updatedAt: 'desc' },
    include: {
      user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      _count: { select: { replies: true } },
    },
  });

  res.json({ threads: posts });
});

export default router;
