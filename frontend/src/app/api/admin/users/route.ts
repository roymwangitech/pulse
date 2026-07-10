import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticate } from '@/lib/auth-server';

export async function GET(req: NextRequest) {
  try {
    const user = await authenticate(req);
    if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') ?? '1');
    const q = searchParams.get('q')?.trim() ?? '';
    const limit = 15;
    const skip = (page - 1) * limit;

    const where = q
      ? { OR: [{ username: { contains: q, mode: 'insensitive' as const } }, { displayName: { contains: q, mode: 'insensitive' as const } }] }
      : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { username: 'asc' },
        select: { id: true, username: true, displayName: true, avatarUrl: true, role: true, status: true, postingBlocked: true, createdAt: true, _count: { select: { posts: true } } },
      }),
      prisma.user.count({ where }),
    ]);

    return NextResponse.json({ users, total, page, totalPages: Math.ceil(total / limit) });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
