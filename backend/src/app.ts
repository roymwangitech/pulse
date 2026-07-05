import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { config } from './config/index.js';
import { errorHandler } from './middleware/error.js';
import authRoutes from './routes/auth.js';
import postRoutes from './routes/posts.js';
import reactionRoutes from './routes/reactions.js';
import threadRoutes from './routes/threads.js';
import userRoutes from './routes/users.js';
import searchRoutes from './routes/search.js';
import adminRoutes from './routes/admin.js';

const app = express();

app.set('trust proxy', 1);

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false,
}));

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (server-to-server, health checks)
    if (!origin) return callback(null, true);

    const allowed = config.cors.origin
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);

    if (allowed.includes(origin) || allowed.includes('*')) {
      return callback(null, true);
    }
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});

app.use('/api', limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many auth attempts' },
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/reactions', reactionRoutes);
app.use('/api/threads', threadRoutes);
app.use('/api/users', userRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/admin', adminRoutes);

app.use(errorHandler);

export default app;
