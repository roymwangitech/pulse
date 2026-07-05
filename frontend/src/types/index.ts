export interface User {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string;
  role: string;
  status: string;
  createdAt: string;
  postCount?: number;
  replyCount?: number;
}

export interface Reaction {
  emoji: string;
  count: number;
  userIds?: string[];
}

export interface Post {
  id: string;
  caption: string;
  createdAt: string;
  user: Pick<User, 'id' | 'username' | 'displayName' | 'avatarUrl'>;
  hashtags: string[];
  reactions: Reaction[];
  replyCount: number;
}
export interface ThreadReply {
  id: string;
  postId: string;
  parentReplyId: string | null;
  content: string;
  depth: number;
  createdAt: string;
  user: Pick<User, 'id' | 'username' | 'displayName' | 'avatarUrl'>;
  reactions: Reaction[];
  childCount: number;
}

export interface TrendingHashtag {
  name: string;
  postCount: number;
}

export type DateFilter = 'all' | 'today' | '7days' | '30days' | 'year' | 'custom';

export interface OnlineUsers {
  count: number;
  users: { userId: string; username: string }[];
}
