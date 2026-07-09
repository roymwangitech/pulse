export function formatPostReactions(reactions: { emoji: string; userId: string }[]) {
  const map = new Map<string, { emoji: string; count: number; userIds: string[] }>();
  for (const r of reactions) {
    const e = map.get(r.emoji);
    if (e) { e.count++; e.userIds.push(r.userId); }
    else map.set(r.emoji, { emoji: r.emoji, count: 1, userIds: [r.userId] });
  }
  return Array.from(map.values());
}

export function formatPost(post: {
  id: string; caption: string; imageUrl: string | null; pinned: boolean; createdAt: Date; updatedAt: Date;
  user: { id: string; username: string; displayName: string | null; avatarUrl: string };
  hashtags: { hashtag: { name: string } }[];
  reactions: { emoji: string; userId: string }[];
  _count: { replies: number };
}) {
  const edited = post.updatedAt.getTime() - post.createdAt.getTime() > 2000;
  return {
    id: post.id,
    caption: post.caption,
    imageUrl: post.imageUrl,
    pinned: post.pinned,
    createdAt: post.createdAt,
    editedAt: edited ? post.updatedAt : null,
    user: post.user,
    hashtags: post.hashtags.map((ph) => ph.hashtag.name),
    reactions: formatPostReactions(post.reactions),
    replyCount: post._count.replies,
  };
}

export const postInclude = {
  user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
  hashtags: { include: { hashtag: true } },
  reactions: true,
  _count: { select: { replies: true } },
};

export function extractHashtags(text: string): string[] {
  const matches = text.match(/#[\w\u00C0-\u024F]+/g);
  if (!matches) return [];
  return [...new Set(matches.map((t) => t.slice(1).toLowerCase()))];
}

export function buildSearchText(caption?: string | null, username?: string): string {
  const parts: string[] = [];
  if (caption) parts.push(caption);
  if (username) parts.push(username);
  const tags = caption ? extractHashtags(caption) : [];
  parts.push(...tags.map((h) => `#${h}`));
  return parts.join(' ').toLowerCase();
}

export function getDateRangeFilter(filter: string, start?: string, end?: string) {
  const now = new Date();
  const sod = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  switch (filter) {
    case 'today': return { gte: sod(now) };
    case '7days': { const d = new Date(now); d.setDate(d.getDate() - 7); return { gte: d }; }
    case '30days': { const d = new Date(now); d.setDate(d.getDate() - 30); return { gte: d }; }
    case 'year': return { gte: new Date(now.getFullYear(), 0, 1) };
    case 'custom': return { gte: start ? new Date(start) : undefined, lte: end ? new Date(end) : undefined };
    default: return {};
  }
}

export function calculateReplyDepth(parentDepth: number): number {
  const depth = parentDepth + 1;
  if (depth > 4) throw new Error('Maximum reply depth of 5 levels exceeded');
  return depth;
}
