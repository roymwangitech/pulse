import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticate } from '@/lib/auth-server';
import { generateAvatarUrl, generateAvatarSeed } from '@/lib/avatar';

export async function POST(req: NextRequest) {
  try {
    const user = await authenticate(req);
    const seed = generateAvatarSeed();
    const avatarUrl = generateAvatarUrl(user.username, seed);
    const updated = await prisma.user.update({ where: { id: user.userId }, data: { avatarUrl } });
    return NextResponse.json({ avatarUrl: updated.avatarUrl });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
