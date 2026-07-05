import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticate, sanitizeUser } from '@/lib/auth-server';

export async function PATCH(req: NextRequest) {
  try {
    const authUser = await authenticate(req);
    const body = await req.json();
    const { displayName } = body;
    if (!displayName || typeof displayName !== 'string' || displayName.length > 50) {
      return NextResponse.json({ error: 'Invalid display name' }, { status: 400 });
    }
    const user = await prisma.user.update({ where: { id: authUser.userId }, data: { displayName } });
    return NextResponse.json({ user: sanitizeUser(user) });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
