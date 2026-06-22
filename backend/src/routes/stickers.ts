import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

const router = Router();

router.get('/', async (req, res) => {
  const category = req.query.category as string | undefined;

  const stickers = await prisma.sticker.findMany({
    where: category ? { category: category as never } : undefined,
    orderBy: { category: 'asc' },
  });

  res.json({ stickers });
});

router.get('/categories', async (_req, res) => {
  const categories = await prisma.sticker.groupBy({
    by: ['category'],
    _count: { category: true },
  });

  res.json({
    categories: categories.map((c) => ({
      name: c.category,
      count: c._count.category,
    })),
  });
});

export default router;
