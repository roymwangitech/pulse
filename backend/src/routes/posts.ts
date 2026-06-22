import { Router, Response } from 'express';
import { paramId } from '../lib/params.js';
import multer from 'multer';
import { prisma } from '../lib/prisma.js';
import { storage } from '../lib/storage.js';
import { extractHashtags, buildSearchText, getDateRangeFilter } from '../lib/utils.js';
import { formatPost, postInclude } from '../lib/posts.js';
import { authenticate, optionalAuth, AuthRequest } from '../middleware/auth.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { createPostSchema, feedQuerySchema } from '../validators/schemas.js';
import { config } from '../config/index.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.upload.maxFileSize },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

async function syncHashtags(postId: string, caption?: string) {
  if (!caption) return;
  const tags = extractHashtags(caption);
  for (const name of tags) {
    const hashtag = await prisma.hashtag.upsert({
      where: { name },
      create: { name },
      update: {},
    });
    await prisma.postHashtag.upsert({
      where: { postId_hashtagId: { postId, hashtagId: hashtag.id } },
      create: { postId, hashtagId: hashtag.id },
      update: {},
    });
  }
}


async function fetchPosts(where: Record<string, unknown>, limit: number, cursor?: string) {
  return prisma.post.findMany({
    where,
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: { createdAt: 'desc' },
    include: postInclude,
  });
}

router.get('/', optionalAuth, validateQuery(feedQuerySchema), async (req, res) => {
  const { cursor, limit, filter, startDate, endDate } = (req as typeof req & { validatedQuery: { cursor?: string; limit: number; filter: string; startDate?: string; endDate?: string } }).validatedQuery;

  const dateFilter = filter !== 'all' ? getDateRangeFilter(filter, startDate, endDate) : {};
  const where = { createdAt: dateFilter };

  const posts = await fetchPosts(where, limit, cursor);
  const hasMore = posts.length > limit;
  const items = hasMore ? posts.slice(0, limit) : posts;

  res.json({
    posts: items.map(formatPost),
    nextCursor: hasMore ? items[items.length - 1].id : null,
    hasMore,
  });
});

router.get('/:id', optionalAuth, async (req, res) => {
  const id = paramId(req.params.id);
  const post = await prisma.post.findUnique({
    where: { id },
    include: postInclude,
  });

  if (!post) {
    res.status(404).json({ error: 'Post not found' });
    return;
  }

  res.json({ post: formatPost(post) });
});

router.post(
  '/',
  authenticate,
  upload.single('media'),
  validateBody(createPostSchema),
  async (req: AuthRequest, res: Response) => {
    const { caption, stickerUrl } = req.body as { caption?: string; stickerUrl?: string };
    const file = req.file;
    const trimmedCaption = caption?.trim();

    if (!file && !stickerUrl && !trimmedCaption) {
      res.status(400).json({ error: 'Post must include a caption, image, GIF, or sticker' });
      return;
    }

    let imageUrl: string | undefined;
    if (file) {
      imageUrl = await storage.upload(file, 'posts');
    }

    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    const searchText = buildSearchText(trimmedCaption, user?.username);

    const post = await prisma.post.create({
      data: {
        userId: req.user!.userId,
        imageUrl,
        stickerUrl: stickerUrl || undefined,
        caption: trimmedCaption,
        searchText,
      },
      include: postInclude,
    });

    await syncHashtags(post.id, trimmedCaption);

    const formatted = formatPost(post);
    const io = req.app.get('io');
    io?.emit('post:new', formatted);

    res.status(201).json({ post: formatted });
  }
);

router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  const id = paramId(req.params.id);
  const post = await prisma.post.findUnique({ where: { id } });
  if (!post) {
    res.status(404).json({ error: 'Post not found' });
    return;
  }
  if (post.userId !== req.user!.userId && req.user!.role !== 'ADMIN') {
    res.status(403).json({ error: 'Not authorized' });
    return;
  }

  await prisma.post.delete({ where: { id } });
  const io = req.app.get('io');
  io?.emit('post:deleted', { postId: id });

  res.json({ message: 'Post deleted' });
});

export default router;
