import bcrypt from 'bcrypt';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import { prisma } from './db';

const SALT_ROUNDS = 12;

export interface TokenPayload {
  userId: string;
  username: string;
  role: string;
}

function accessSecret() {
  return process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret';
}

function refreshSecretValue() {
  return process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret';
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function signAccessToken(payload: TokenPayload): string {
  const opts: SignOptions = { expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN ?? '15m') as SignOptions['expiresIn'] };
  return jwt.sign(payload, accessSecret(), opts);
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, accessSecret()) as TokenPayload;
}

export async function createRefreshToken(userId: string): Promise<string> {
  const token = randomBytes(40).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);
  await prisma.refreshToken.create({ data: { token, userId, expiresAt } });
  return token;
}

export async function revokeRefreshToken(token: string) {
  await prisma.refreshToken.deleteMany({ where: { token } });
}

export async function validateRefreshToken(token: string): Promise<TokenPayload | null> {
  try {
    const stored = await prisma.refreshToken.findUnique({ where: { token } });
    if (!stored || stored.expiresAt < new Date()) return null;
    return jwt.verify(token.length === 80 ? stored.token : token, refreshSecretValue()) as TokenPayload;
  } catch {
    return null;
  }
}

export function sanitizeUser(user: {
  id: string; username: string; displayName: string | null;
  avatarUrl: string; role: string; status: string; postingBlocked: boolean; createdAt: Date;
}) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    role: user.role,
    status: user.status,
    postingBlocked: user.postingBlocked,
    createdAt: user.createdAt,
  };
}

/** Extract Bearer token from Authorization header */
export function extractToken(request: Request): string | null {
  const auth = request.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

/** Authenticate a request, returns the token payload or throws a Response */
export async function authenticate(request: Request): Promise<TokenPayload> {
  const token = extractToken(request);
  if (!token) throw new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401 });
  try {
    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user || user.status === 'BANNED') {
      throw new Response(JSON.stringify({ error: 'Account suspended' }), { status: 403 });
    }
    // Always use the DB role so promotions/demotions take effect without re-login
    return { ...payload, role: user.role };
  } catch (e) {
    if (e instanceof Response) throw e;
    throw new Response(JSON.stringify({ error: 'Invalid or expired token' }), { status: 401 });
  }
}

export function optionalAuth(request: Request): TokenPayload | null {
  const token = extractToken(request);
  if (!token) return null;
  try {
    return verifyAccessToken(token);
  } catch {
    return null;
  }
}
