import { z } from 'zod';

export const registerSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(50).optional(),
});

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const createPostSchema = z.object({
  caption: z.string().max(500).optional(),
  stickerUrl: z.string().optional(),
});

export const createReplySchema = z.object({
  content: z.string().max(500).optional(),
  parentReplyId: z.string().optional(),
  stickerUrl: z.string().optional(),
});

export const reactionSchema = z.object({
  emoji: z.string().min(1).max(10),
});

export const feedQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(50).default(20),
  filter: z.enum(['all', 'today', '7days', '30days', 'year', 'custom']).default('all'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const searchQuerySchema = z.object({
  q: z.string().min(1).max(100),
  type: z.enum(['all', 'users', 'hashtags', 'captions']).default('all'),
  limit: z.coerce.number().min(1).max(50).default(20),
});

export const threadQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(50).default(15),
  parentReplyId: z.string().optional(),
});

export const banUserSchema = z.object({
  reason: z.string().max(500).optional(),
});
