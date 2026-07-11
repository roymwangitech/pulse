import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';

const schema = z.object({
  q: z.string().min(1).max(100),
  type: z.enum(['all', 'users', 'hashtags', 'captions']).default('all'),
  limit: z.coerce.number().min(1).max(50).default(20),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const parsed = schema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) return NextResponse.json({ error: 'Validation failed' }, { status: 400 });

    const { q, type, limit } = parsed.data;
    const query = q.trim().toLowerCase();
    const results: { users: unknown[]; hashtags: unknown[]; posts: unknown[] } = { users: [], hashtags: [], posts: [] };

    if (type === 'all' || type === 'users') {
      results.users = await prisma.user.findMany({
        where: { OR: [{ username: { contains: query, mode: 'insensitive' } }, { displayName: { contains: query, mode: 'insensitive' } }], status: 'ACTIVE' },
        take: limit,
        select: { id: true, username: true, displayName: true, avatarUrl: true },
      });
    }
    if (type === 'all' || type === 'hashtags') {
      const tag = query.startsWith('#') ? query.slice(1) : query;
      results.hashtags = await prisma.hashtag.findMany({
        where: { name: { contains: tag, mode: 'insensitive' } },
        take: limit,
        select: {
          name: true,
          _count: { select: { posts: true } },
        },
      });
    }
    if (type === 'all' || type === 'captions') {
      results.posts = await prisma.post.findMany({
        where: { OR: [{ searchText: { contains: query, mode: 'insensitive' } }, { caption: { contains: query, mode: 'insensitive' } }] },
        take: limit, orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          caption: true,
          user: { select: { username: true } },
        },
      });
    }

    return NextResponse.json(results);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
