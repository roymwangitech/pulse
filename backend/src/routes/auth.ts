import { Router, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import {
  hashPassword,
  verifyPassword,
  signAccessToken,
  createRefreshToken,
  revokeRefreshToken,
  validateRefreshToken,
  sanitizeUser,
  signRefreshToken,
} from '../lib/auth.js';
import { generateAvatarUrl } from '../lib/avatar.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { registerSchema, loginSchema } from '../validators/schemas.js';
import { config } from '../config/index.js';

const router = Router();

const cookieOptions = {
  httpOnly: true,
  secure: config.nodeEnv === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

router.post('/register', validateBody(registerSchema), async (req, res) => {
  const { username, password, displayName } = req.body;

  const existing = await prisma.user.findUnique({ where: { username: username.toLowerCase() } });
  if (existing) {
    res.status(409).json({ error: 'Username already taken' });
    return;
  }

  const passwordHash = await hashPassword(password);
  const avatarUrl = generateAvatarUrl(username);

  const user = await prisma.user.create({
    data: {
      username: username.toLowerCase(),
      displayName: displayName ?? username,
      passwordHash,
      avatarUrl,
    },
  });

  const tokenPayload = { userId: user.id, username: user.username, role: user.role };
  const accessToken = signAccessToken(tokenPayload);
  const refreshToken = await createRefreshToken(user.id);

  res.cookie('accessToken', accessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 });
  res.cookie('refreshToken', refreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });

  res.status(201).json({
    user: sanitizeUser(user),
    accessToken,
    refreshToken,
  });
});

router.post('/login', validateBody(loginSchema), async (req, res) => {
  const { username, password } = req.body;

  const user = await prisma.user.findUnique({ where: { username: username.toLowerCase() } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  if (user.status === 'BANNED') {
    res.status(403).json({ error: 'Account has been suspended' });
    return;
  }

  const tokenPayload = { userId: user.id, username: user.username, role: user.role };
  const accessToken = signAccessToken(tokenPayload);
  const refreshToken = await createRefreshToken(user.id);

  res.cookie('accessToken', accessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 });
  res.cookie('refreshToken', refreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });

  res.json({
    user: sanitizeUser(user),
    accessToken,
    refreshToken,
  });
});

router.post('/refresh', async (req, res) => {
  const token = req.cookies?.refreshToken ?? req.body.refreshToken;
  if (!token) {
    res.status(401).json({ error: 'Refresh token required' });
    return;
  }

  const payload = await validateRefreshToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Invalid refresh token' });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user || user.status === 'BANNED') {
    res.status(403).json({ error: 'Account suspended' });
    return;
  }

  await revokeRefreshToken(token);

  const tokenPayload = { userId: user.id, username: user.username, role: user.role };
  const accessToken = signAccessToken(tokenPayload);
  const newRefreshToken = await createRefreshToken(user.id);

  res.cookie('accessToken', accessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 });
  res.cookie('refreshToken', newRefreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });

  res.json({ accessToken, refreshToken: newRefreshToken });
});

router.post('/logout', authenticate, async (req: AuthRequest, res: Response) => {
  const token = req.cookies?.refreshToken ?? req.body.refreshToken;
  if (token) await revokeRefreshToken(token);
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  res.json({ message: 'Logged out' });
});

router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json({ user: sanitizeUser(user) });
});

export default router;
