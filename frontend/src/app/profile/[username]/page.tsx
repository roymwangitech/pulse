'use client';

import { use } from 'react';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/app-layout';
import { Avatar } from '@/components/ui/avatar';
import { PostCard } from '@/components/feed/post-card';
import { api } from '@/lib/api';
import type { User, Post } from '@/types';

export default function UserProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params);

  const { data: profile } = useQuery({
    queryKey: ['profile', username],
    queryFn: () => api.get<{ user: User }>(`/users/${username}`),
  });

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['user-posts', username],
    queryFn: ({ pageParam }) =>
      api.get<{ posts: Post[]; nextCursor: string | null; hasMore: boolean }>(
        `/users/${username}/posts?limit=20${pageParam ? `&cursor=${pageParam}` : ''}`
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : undefined),
    enabled: !!username,
  });

  const posts = data?.pages.flatMap((p) => p.posts) ?? [];
  const user = profile?.user;

  return (
    <AppLayout>
      <div className="border-b border-border">
        {user && (
          <div className="p-3 sm:p-4">
            <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-start sm:text-left">
              <Avatar src={user.avatarUrl} alt={user.username} size="lg" />
              <div className="min-w-0">
                <h1 className="truncate text-xl font-bold sm:text-2xl">{user.displayName ?? user.username}</h1>
                <p className="text-muted-foreground">@{user.username}</p>
                <div className="mt-3 flex justify-center gap-4 text-sm sm:justify-start">
                  <span><strong>{user.postCount ?? 0}</strong> posts</span>
                  <span><strong>{user.replyCount ?? 0}</strong> replies</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      <div>
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
        {hasNextPage && (
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="w-full p-4 text-center text-twitter-blue hover:bg-card/50"
          >
            {isFetchingNextPage ? 'Loading...' : 'Load more'}
          </button>
        )}
      </div>
    </AppLayout>
  );
}
