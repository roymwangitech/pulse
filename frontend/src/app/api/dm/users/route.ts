import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticate } from '@/lib/auth-server';

// GET /api/dm/users — list all users except self for new message discovery
export async function GET(req: NextRequest) {
  try {
    const me = await authenticate(req);
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q')?.trim().toLowerCase() ?? '';

    const users = await prisma.user.findMany({
      where: {
        id: { not: me.userId },
        status: 'ACTIVE',
        ...(q ? {
          OR: [
            { username: { contains: q, mode: 'insensitive' } },
            { displayName: { contains: q, mode: 'insensitive' } },
          ],
        } : {}),
      },
      select: { id: true, username: true, displayName: true, avatarUrl: true },
      orderBy: { username: 'asc' },
      take: 50,
    });

    return NextResponse.json({ users });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
