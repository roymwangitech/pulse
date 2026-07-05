'use client';

import { use, useState } from 'react';
import { useQuery, useInfiniteQuery, useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Mail } from 'lucide-react';
import { AppLayout } from '@/components/layout/app-layout';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { PostCard } from '@/components/feed/post-card';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import type { User, Post } from '@/types';

export default function UserProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params);
  const router = useRouter();
  const me = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const [dmError, setDmError] = useState('');

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

  const startDm = useMutation({
    mutationFn: () =>
      api.post<{ conversation: { id: string } }>('/dm', { username }, accessToken ?? undefined),
    onSuccess: (res) => router.push(`/messages/${res.conversation.id}`),
    onError: (e) => setDmError((e as Error).message),
  });

  const posts = data?.pages.flatMap((p) => p.posts) ?? [];
  const user = profile?.user;
  const isOwnProfile = me?.username === username;

  return (
    <AppLayout>
      <div className="border-b border-border">
        {user && (
          <div className="p-3 sm:p-4">
            <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-start sm:text-left">
              <Avatar src={user.avatarUrl} alt={user.username} size="lg" />
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-xl font-bold sm:text-2xl">{user.displayName ?? user.username}</h1>
                <p className="text-muted-foreground">@{user.username}</p>
                <div className="mt-3 flex flex-wrap items-center justify-center gap-3 sm:justify-start">
                  <span className="text-sm"><strong>{user.postCount ?? 0}</strong> posts</span>
                  <span className="text-sm"><strong>{user.replyCount ?? 0}</strong> replies</span>
                  {!isOwnProfile && accessToken && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => startDm.mutate()}
                      disabled={startDm.isPending}
                      className="gap-1.5"
                    >
                      <Mail className="h-3.5 w-3.5" />
                      Message
                    </Button>
                  )}
                </div>
                {dmError && <p className="mt-1 text-xs text-red-500">{dmError}</p>}
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
