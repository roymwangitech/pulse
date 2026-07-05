import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { hashPassword, signAccessToken, createRefreshToken, sanitizeUser } from '@/lib/auth-server';
import { generateAvatarUrl } from '@/lib/avatar';

const schema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(50).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Validation failed' }, { status: 400 });

    const { username, password, displayName } = parsed.data;
    const existing = await prisma.user.findUnique({ where: { username: username.toLowerCase() } });
    if (existing) return NextResponse.json({ error: 'Username already taken' }, { status: 409 });

    const passwordHash = await hashPassword(password);
    const avatarUrl = generateAvatarUrl(username);

    const user = await prisma.user.create({
      data: { username: username.toLowerCase(), displayName: displayName ?? username, passwordHash, avatarUrl },
    });

    const tokenPayload = { userId: user.id, username: user.username, role: user.role };
    const accessToken = signAccessToken(tokenPayload);
    const refreshToken = await createRefreshToken(user.id);

    return NextResponse.json({ user: sanitizeUser(user), accessToken, refreshToken }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
