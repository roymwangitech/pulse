export function formatPostReactions(reactions: { emoji: string; userId: string }[]) {
  const reactionMap = new Map<string, { emoji: string; count: number; userIds: string[] }>();
  for (const r of reactions) {
    const existing = reactionMap.get(r.emoji);
    if (existing) {
      existing.count++;
      existing.userIds.push(r.userId);
    } else {
      reactionMap.set(r.emoji, { emoji: r.emoji, count: 1, userIds: [r.userId] });
    }
  }
  return Array.from(reactionMap.values());
}

export function formatPost(post: {
  id: string;
  caption: string;
  createdAt: Date;
  user: { id: string; username: string; displayName: string | null; avatarUrl: string };
  hashtags: { hashtag: { name: string } }[];
  reactions: { emoji: string; userId: string }[];
  _count: { replies: number };
}) {
  return {
    id: post.id,
    caption: post.caption,
    createdAt: post.createdAt,
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
