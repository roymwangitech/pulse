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
  imageUrl: string | null;
  createdAt: string;
  editedAt: string | null;
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
  editedAt?: string;
  imageUrl?: string | null;
  user: Pick<User, 'id' | 'username' | 'displayName' | 'avatarUrl'>;
  reactions: Reaction[];
  childCount: number;
}

export interface TrendingHashtag {
  name: string;
  postCount: number;
}

export type DateFilter = 'all' | 'today' | '7days' | '30days' | 'year' | 'custom';

export interface DMUser {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string;
}

export interface DMConversation {
  id: string;
  other: DMUser;
  lastMessage: { content: string; createdAt: string; fromMe: boolean } | null;
  unread: number;
  updatedAt: string;
}

export interface DirectMessage {
  id: string;
  content: string;
  senderId: string;
  fromMe: boolean;
  readAt: string | null;
  createdAt: string;
  replyToId?: string | null;
  replyTo?: { id: string; content: string; senderId: string } | null;
}
