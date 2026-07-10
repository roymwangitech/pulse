'use client';

import { useEffect, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { useFeedStore } from '@/stores/feed';
import { PostCard } from './post-card';
import type { Post, DateFilter } from '@/types';

const PAGE_SIZE = 10;

interface FeedProps {
  filter?: DateFilter;
  startDate?: string;
  endDate?: string;
}

export function Feed({ filter = 'today', startDate, endDate }: FeedProps) {
  const setPosts = useFeedStore((s) => s.setPosts);
  const appendPosts = useFeedStore((s) => s.appendPosts);
  const posts = useFeedStore((s) => s.posts);
  

  const buildQuery = (cursor?: string) => {
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), filter });
    if (cursor) params.set('cursor', cursor);
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    return `/posts?${params}`;
  };

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError, refetch, isFetching } =
    useInfiniteQuery({
      queryKey: ['feed', filter, startDate, endDate],
      queryFn: ({ pageParam }) =>
        api.get<{ posts: Post[]; nextCursor: string | null; hasMore: boolean }>(
          buildQuery(pageParam as string | undefined)
        ),
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : undefined),
    });

  const [refreshed, setRefreshed] = useState(false);
  const handleRefresh = async () => {
    await refetch();
    setRefreshed(true);
    setTimeout(() => setRefreshed(false), 1500);
  };

  useEffect(() => {
    if (data?.pages[0]) {
      setPosts(data.pages[0].posts);
      for (let i = 1; i < data.pages.length; i++) {
        appendPosts(data.pages[i].posts);
      }
    }
  }, [data, setPosts, appendPosts]);

  // No intersection observer: load more is manual via button to avoid automatic loading

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-8">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-48 animate-pulse rounded-2xl bg-card" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Failed to load feed. Is the API running?
      </div>
    );
  }
  // Combine pages into a single array (store has posts but ensure pinned stay on top)
  const allPosts = data?.pages.flatMap((p) => p.posts) ?? posts;

  if (!allPosts.length) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        No posts yet. Be the first to pulse!
      </div>
    );
  }
  const pinnedPosts = allPosts.filter((p) => p.pinned);
  const normalPosts = allPosts.filter((p) => !p.pinned);

  return (
    <div>
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <span className="text-sm text-muted-foreground">Latest posts</span>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleRefresh}
          disabled={isFetching}
          className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          aria-label="Refresh feed"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''} ${refreshed ? 'text-twitter-blue' : ''}`} />
          {isFetching ? 'Refreshing…' : refreshed ? 'Updated' : 'Refresh'}
        </Button>
      </div>

      {/* Pinned posts always at top */}
      {pinnedPosts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}

      {/* Normal posts (page 0 shown initially). Use manual Load more to fetchNextPage. */}
      {normalPosts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}

      <div className="p-4 flex items-center justify-center">
        {hasNextPage ? (
          <Button size="sm" variant="ghost" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
            {isFetchingNextPage ? 'Loading...' : 'Load more'}
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">No more posts</span>
        )}
      </div>
    </div>
  );
}
