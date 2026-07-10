import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticate } from '@/lib/auth-server';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authUser = await authenticate(req);
    if (authUser.role !== 'ADMIN') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    const { id } = await params;
    const user = await prisma.user.update({ where: { id }, data: { postingBlocked: true } });
    return NextResponse.json({ user: { id: user.id, postingBlocked: user.postingBlocked } });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
