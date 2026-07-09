import { Router, Response } from 'express';
import { paramId } from '../lib/params.js';
import { prisma } from '../lib/prisma.js';
import { extractHashtags, buildSearchText, getDateRangeFilter } from '../lib/utils.js';
import { formatPost, postInclude } from '../lib/posts.js';
import { authenticate, optionalAuth, AuthRequest } from '../middleware/auth.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { createPostSchema, feedQuerySchema } from '../validators/schemas.js';

const router = Router();

async function syncHashtags(postId: string, caption: string) {
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

router.post('/', authenticate, validateBody(createPostSchema), async (req: AuthRequest, res: Response) => {
  const { caption, imageUrl } = req.body as { caption?: string; imageUrl?: string };
  const trimmedCaption = caption?.trim() || '';

  if (!trimmedCaption && !imageUrl) {
    res.status(400).json({ error: 'Post must include a message or an image' });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  const searchText = buildSearchText(trimmedCaption, user?.username);

  const post = await prisma.post.create({
    data: {
      userId: req.user!.userId,
      caption: trimmedCaption,
      imageUrl: imageUrl || null,
      searchText,
    },
    include: postInclude,
  });

  await syncHashtags(post.id, trimmedCaption);

  const formatted = formatPost(post);
  const io = req.app.get('io');
  io?.emit('post:new', formatted);

  res.status(201).json({ post: formatted });
});

router.post('/:id/pin', authenticate, async (req: AuthRequest, res: Response) => {
  const id = paramId(req.params.id);
  const post = await prisma.post.findUnique({ where: { id }, include: postInclude });
  if (!post) {
    res.status(404).json({ error: 'Post not found' });
    return;
  }
  if (post.userId !== req.user!.userId) {
    res.status(403).json({ error: 'Not authorized' });
    return;
  }

  let action: string;
  let updatedPost;

  if (post.pinned) {
    updatedPost = await prisma.post.update({
      where: { id },
      data: { pinned: false },
      include: postInclude,
    });
    action = 'unpinned';
  } else {
    await prisma.post.updateMany({
      where: { userId: req.user!.userId, pinned: true },
      data: { pinned: false },
    });
    updatedPost = await prisma.post.update({
      where: { id },
      data: { pinned: true },
      include: postInclude,
    });
    action = 'pinned';
  }

  const formatted = formatPost(updatedPost);
  const io = req.app.get('io');
  io?.emit('post:updated', formatted);

  res.json({ action, post: formatted });
});

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
