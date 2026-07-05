import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { verifyPassword, signAccessToken, createRefreshToken, sanitizeUser } from '@/lib/auth-server';

const schema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Validation failed' }, { status: 400 });

    const { username, password } = parsed.data;
    const user = await prisma.user.findUnique({ where: { username: username.toLowerCase() } });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }
    if (user.status === 'BANNED') return NextResponse.json({ error: 'Account has been suspended' }, { status: 403 });

    const tokenPayload = { userId: user.id, username: user.username, role: user.role };
    const accessToken = signAccessToken(tokenPayload);
    const refreshToken = await createRefreshToken(user.id);

    return NextResponse.json({ user: sanitizeUser(user), accessToken, refreshToken });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
