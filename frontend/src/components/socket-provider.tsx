'use client';

import { useEffect } from 'react';
import { connectSocket, disconnectSocket } from '@/lib/socket';
import { useAuthStore } from '@/stores/auth';
import { useFeedStore } from '@/stores/feed';
import type { Post } from '@/types';

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const prependPost = useFeedStore((s) => s.prependPost);
  const updatePost = useFeedStore((s) => s.updatePost);
  const removePost = useFeedStore((s) => s.removePost);

  useEffect(() => {
    const socket = connectSocket(accessToken ?? undefined);

    socket.on('post:new', (post: Post) => prependPost(post));

    socket.on('post:deleted', ({ postId }: { postId: string }) => removePost(postId));

    socket.on(
      'reaction:added',
      ({ postId, emoji, userId }: { postId: string; emoji: string; userId: string }) => {
        updatePost(postId, {
          reactions: useFeedStore.getState().posts
            .find((p) => p.id === postId)
            ?.reactions.map((r) =>
              r.emoji === emoji
                ? { ...r, count: r.count + 1, userIds: [...(r.userIds ?? []), userId] }
                : r
            ) ?? [{ emoji, count: 1, userIds: [userId] }],
        });
      }
    );

    socket.on(
      'reaction:removed',
      ({ postId, emoji, userId }: { postId: string; emoji: string; userId: string }) => {
        const post = useFeedStore.getState().posts.find((p) => p.id === postId);
        if (!post) return;
        const reactions = post.reactions
          .map((r) =>
            r.emoji === emoji
              ? { ...r, count: r.count - 1, userIds: (r.userIds ?? []).filter((id) => id !== userId) }
              : r
          )
          .filter((r) => r.count > 0);
        updatePost(postId, { reactions });
      }
    );

    socket.on('thread:updated', ({ postId, replyCount }: { postId: string; replyCount: number }) => {
      updatePost(postId, { replyCount });
    });

    return () => {
      socket.off('post:new');
      socket.off('post:deleted');
      socket.off('reaction:added');
      socket.off('reaction:removed');
      socket.off('thread:updated');
      disconnectSocket();
    };
  }, [accessToken, prependPost, updatePost, removePost]);

  return <>{children}</>;
}
