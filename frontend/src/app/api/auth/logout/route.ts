import { NextRequest, NextResponse } from 'next/server';
import { authenticate, revokeRefreshToken } from '@/lib/auth-server';

export async function POST(req: NextRequest) {
  try {
    await authenticate(req);
    const body = await req.json().catch(() => ({}));
    if (body.refreshToken) await revokeRefreshToken(body.refreshToken);
    return NextResponse.json({ message: 'Logged out' });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
