import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { signAccessToken, createRefreshToken, revokeRefreshToken } from '@/lib/auth-server';
import jwt from 'jsonwebtoken';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const token = body.refreshToken as string | undefined;
    if (!token) return NextResponse.json({ error: 'Refresh token required' }, { status: 401 });

    const stored = await prisma.refreshToken.findUnique({ where: { token } });
    if (!stored || stored.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Invalid refresh token' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user || user.status === 'BANNED') {
      return NextResponse.json({ error: 'Account suspended' }, { status: 403 });
    }

    await revokeRefreshToken(token);
    const tokenPayload = { userId: user.id, username: user.username, role: user.role };
    const accessToken = signAccessToken(tokenPayload);
    const newRefreshToken = await createRefreshToken(user.id);

    return NextResponse.json({ accessToken, refreshToken: newRefreshToken });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
