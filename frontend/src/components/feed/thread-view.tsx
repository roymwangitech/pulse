'use client';

import { useEffect, useState } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, ChevronDown } from 'lucide-react';
import { api } from '@/lib/api';
import { connectSocket, getSocket } from '@/lib/socket';
import { useAuthStore } from '@/stores/auth';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { PostCard } from '@/components/feed/post-card';
import { formatRelativeTime } from '@/lib/utils';
import type { Post, ThreadReply } from '@/types';

const REPLIES_PAGE_SIZE = 15;
const CHILD_REPLIES_PAGE_SIZE = 10;

interface ThreadRepliesResponse {
  replies: ThreadReply[];
  nextCursor: string | null;
  hasMore: boolean;
  total: number;
}

function buildThreadUrl(postId: string, parentReplyId?: string, cursor?: string) {
  const params = new URLSearchParams({ limit: String(REPLIES_PAGE_SIZE) });
  if (parentReplyId) params.set('parentReplyId', parentReplyId);
  if (cursor) params.set('cursor', cursor);
  return `/threads/${postId}?${params}`;
}

function buildChildThreadUrl(postId: string, parentReplyId: string, cursor?: string) {
  const params = new URLSearchParams({ limit: String(CHILD_REPLIES_PAGE_SIZE), parentReplyId });
  if (cursor) params.set('cursor', cursor);
  return `/threads/${postId}?${params}`;
}

function ReplyItem({
  reply,
  postId,
  depth = 0,
}: {
  reply: ThreadReply;
  postId: string;
  depth?: number;
}) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [content, setContent] = useState('');
  const [showReply, setShowReply] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const queryClient = useQueryClient();
  const mediaUrl = reply.imageUrl ?? reply.stickerUrl;
  const childTotal = reply.childCount ?? 0;

  const {
    data: childData,
    fetchNextPage: fetchMoreChildren,
    hasNextPage: hasMoreChildren,
    isFetchingNextPage: loadingMoreChildren,
    isLoading: loadingChildren,
  } = useInfiniteQuery({
    queryKey: ['thread-children', postId, reply.id],
    queryFn: ({ pageParam }) =>
      api.get<ThreadRepliesResponse>(buildChildThreadUrl(postId, reply.id, pageParam as string | undefined)),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : undefined),
    enabled: childTotal > 0,
  });

  const children = childData?.pages.flatMap((p) => p.replies) ?? [];
  const remainingChildren = Math.max(0, childTotal - children.length);

  const handleReply = async () => {
    if (!accessToken || !content.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.post<{ reply: ThreadReply }>(
        `/threads/${postId}`,
        { content: content.trim(), parentReplyId: reply.id },
        accessToken
      );
      queryClient.setQueryData(
        ['thread-children', postId, reply.id],
        (old: { pages: ThreadRepliesResponse[]; pageParams: unknown[] } | undefined) => {
          if (!old) {
            return { pages: [{ replies: [res.reply], nextCursor: null, hasMore: false, total: 1 }], pageParams: [undefined] };
          }
          const lastIdx = old.pages.length - 1;
          const pages = [...old.pages];
          pages[lastIdx] = {
            ...pages[lastIdx],
            replies: [...pages[lastIdx].replies, res.reply],
            total: pages[lastIdx].total + 1,
          };
          return { ...old, pages };
        }
      );
      queryClient.invalidateQueries({ queryKey: ['thread', postId] });
      setContent('');
      setShowReply(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={depth > 0 ? 'ml-3 border-l border-border pl-2 sm:ml-6 sm:pl-4' : ''}>
      <div className="flex gap-2 py-3 sm:gap-3">
        <Link href={`/profile/${reply.user.username}`}>
          <Avatar src={reply.user.avatarUrl} alt={reply.user.username} size="sm" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-sm">
            <span className="font-bold">{reply.user.displayName ?? reply.user.username}</span>
            <span className="text-muted-foreground">@{reply.user.username}</span>
            <span className="text-muted-foreground">· {formatRelativeTime(reply.createdAt)}</span>
          </div>
          {reply.content && <p className="mt-1 break-words">{reply.content}</p>}
          {mediaUrl && (
            <div className="mt-2 overflow-hidden rounded-xl border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mediaUrl} alt="" className="max-h-60 w-full object-contain" />
            </div>
          )}
          {reply.reactions.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {reply.reactions.map((r) => (
                <span key={r.emoji} className="rounded-full border border-border px-2 py-0.5 text-xs">
                  {r.emoji} {r.count}
                </span>
              ))}
            </div>
          )}
          {depth < 4 && accessToken && (
            <button
              type="button"
              onClick={() => setShowReply(!showReply)}
              className="mt-1 text-sm text-twitter-blue hover:underline"
            >
              Reply
            </button>
          )}
          {showReply && (
            <div className="mt-2 space-y-2">
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleReply()}
                  placeholder="Write a reply..."
                  className="flex-1 rounded-full border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-twitter-blue sm:px-4"
                />
                <Button size="sm" onClick={handleReply} disabled={loading || !content.trim()} className="w-full sm:w-auto">
                  {loading ? 'Sending...' : 'Reply'}
                </Button>
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
            </div>
          )}
        </div>
      </div>

      {loadingChildren && childTotal > 0 && (
        <p className="ml-10 pb-2 text-xs text-muted-foreground">Loading replies...</p>
      )}

      {children.map((child) => (
        <ReplyItem key={child.id} reply={child} postId={postId} depth={depth + 1} />
      ))}

      {hasMoreChildren && (
        <button
          type="button"
          onClick={() => fetchMoreChildren()}
          disabled={loadingMoreChildren}
          className="mb-2 ml-10 flex items-center gap-1 text-sm font-medium text-twitter-blue hover:underline"
        >
          <ChevronDown className="h-4 w-4" />
          {loadingMoreChildren
            ? 'Loading...'
            : `Show more replies${remainingChildren > 0 ? ` (${remainingChildren} remaining)` : ''}`}
        </button>
      )}
    </div>
  );
}

export function ThreadView({ postId }: { postId: string }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const queryClient = useQueryClient();

  const { data: postData } = useQuery({
    queryKey: ['post', postId],
    queryFn: () => api.get<{ post: Post }>(`/posts/${postId}`),
  });

  const {
    data: threadData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: threadLoading,
  } = useInfiniteQuery({
    queryKey: ['thread', postId],
    queryFn: ({ pageParam }) =>
      api.get<ThreadRepliesResponse>(buildThreadUrl(postId, undefined, pageParam as string | undefined)),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : undefined),
  });

  const topLevelReplies = threadData?.pages.flatMap((p) => p.replies) ?? [];
  const topLevelTotal = threadData?.pages[0]?.total ?? 0;
  const totalReplies = postData?.post.replyCount ?? topLevelTotal;
  const loadedCount = topLevelReplies.length;
  const remainingTopLevel = Math.max(0, topLevelTotal - loadedCount);

  useEffect(() => {
    const socket = connectSocket(accessToken ?? undefined);
    socket.emit('thread:join', postId);

    const onNewReply = (reply: ThreadReply) => {
      if (reply.parentReplyId == null) {
        queryClient.setQueryData(
          ['thread', postId],
          (old: { pages: ThreadRepliesResponse[]; pageParams: unknown[] } | undefined) => {
            if (!old?.pages.length) {
              return {
                pages: [{ replies: [reply], nextCursor: null, hasMore: false, total: 1 }],
                pageParams: [undefined],
              };
            }
            const pages = [...old.pages];
            const first = pages[0];
            if (first.replies.some((r) => r.id === reply.id)) return old;
            pages[0] = {
              ...first,
              replies: [...first.replies, reply],
              total: first.total + 1,
            };
            return { ...old, pages };
          }
        );
      } else {
        queryClient.invalidateQueries({ queryKey: ['thread-children', postId, reply.parentReplyId] });
      }

      queryClient.setQueryData(['post', postId], (old: { post: Post } | undefined) => {
        if (!old) return old;
        return { post: { ...old.post, replyCount: old.post.replyCount + 1 } };
      });
    };

    socket.on('reply:new', onNewReply);
    socket.on('typing:start', ({ username, postId: pid }: { username: string; postId: string }) => {
      if (pid === postId) setTypingUsers((prev) => [...new Set([...prev, username])]);
    });
    socket.on('typing:stop', ({ username, postId: pid }: { username: string; postId: string }) => {
      if (pid === postId) setTypingUsers((prev) => prev.filter((u) => u !== username));
    });

    return () => {
      socket.emit('thread:leave', postId);
      socket.off('reply:new', onNewReply);
      socket.off('typing:start');
      socket.off('typing:stop');
    };
  }, [postId, accessToken, queryClient]);

  const handleReply = async () => {
    if (!accessToken || !content.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.post<{ reply: ThreadReply }>(
        `/threads/${postId}`,
        { content: content.trim() },
        accessToken
      );
      queryClient.setQueryData(
        ['thread', postId],
        (old: { pages: ThreadRepliesResponse[]; pageParams: unknown[] } | undefined) => {
          if (!old?.pages.length) {
            return {
              pages: [{ replies: [res.reply], nextCursor: null, hasMore: false, total: 1 }],
              pageParams: [undefined],
            };
          }
          const pages = [...old.pages];
          const first = pages[0];
          if (!first.replies.some((r) => r.id === res.reply.id)) {
            pages[0] = {
              ...first,
              replies: [...first.replies, res.reply],
              total: first.total + 1,
            };
          }
          return { ...old, pages };
        }
      );
      queryClient.setQueryData(['post', postId], (old: { post: Post } | undefined) => {
        if (!old) return old;
        return { post: { ...old.post, replyCount: old.post.replyCount + 1 } };
      });
      setContent('');
      getSocket(accessToken).emit('typing:stop', { postId });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleTyping = () => {
    if (!accessToken) return;
    const socket = getSocket(accessToken);
    socket.emit('typing:start', { postId });
    setTimeout(() => socket.emit('typing:stop', { postId }), 2000);
  };

  return (
    <div>
      <div
        className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/80 px-3 py-3 backdrop-blur sm:gap-4 sm:px-4"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0px))' }}
      >
        <Link href="/" className="shrink-0 rounded-full p-1 hover:bg-border/50">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-lg font-bold sm:text-xl">Thread</h1>
          {totalReplies > 0 && (
            <p className="text-xs text-muted-foreground">{totalReplies} {totalReplies === 1 ? 'reply' : 'replies'}</p>
          )}
        </div>
      </div>

      {postData?.post && <PostCard post={postData.post} variant="detail" />}

      <div className="border-b border-border p-3 sm:p-4">
        {accessToken ? (
          <div className="space-y-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
              <input
                value={content}
                onChange={(e) => { setContent(e.target.value); handleTyping(); }}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleReply()}
                placeholder="Reply to thread..."
                className="flex-1 rounded-full border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-twitter-blue sm:px-4"
              />
              <Button
                onClick={handleReply}
                disabled={loading || !content.trim()}
                className="w-full sm:w-auto"
              >
                {loading ? 'Sending...' : 'Reply'}
              </Button>
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
        ) : (
          <p className="text-center text-muted-foreground">
            <Link href="/login" className="text-twitter-blue hover:underline">Sign in</Link> to reply
          </p>
        )}
        {typingUsers.length > 0 && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 text-xs text-muted-foreground">
            {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
          </motion.p>
        )}
      </div>

      <div className="px-2 sm:px-4">
        {threadLoading && (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading replies...</p>
        )}

        {!threadLoading && topLevelReplies.map((reply) => (
          <ReplyItem key={reply.id} reply={reply} postId={postId} />
        ))}

        {!threadLoading && hasNextPage && (
          <div className="border-t border-border py-4 text-center">
            <Button
              variant="ghost"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="text-twitter-blue hover:bg-twitter-blue/10"
            >
              <ChevronDown className="mr-1 h-4 w-4" />
              {isFetchingNextPage
                ? 'Loading more replies...'
                : `Load more replies${remainingTopLevel > 0 ? ` (${remainingTopLevel} remaining)` : ''}`}
            </Button>
          </div>
        )}

        {!threadLoading && !topLevelReplies.length && (
          <p className="py-8 text-center text-muted-foreground">No replies yet — start the conversation!</p>
        )}
      </div>
    </div>
  );
}
