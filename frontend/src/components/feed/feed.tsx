'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useFeedStore } from '@/stores/feed';
import { PostCard } from './post-card';
import type { Post, DateFilter } from '@/types';

interface FeedProps {
  filter?: DateFilter;
  startDate?: string;
  endDate?: string;
}

export function Feed({ filter = 'all', startDate, endDate }: FeedProps) {
  const setPosts = useFeedStore((s) => s.setPosts);
  const appendPosts = useFeedStore((s) => s.appendPosts);
  const posts = useFeedStore((s) => s.posts);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const buildQuery = (cursor?: string) => {
    const params = new URLSearchParams({ limit: '20', filter });
    if (cursor) params.set('cursor', cursor);
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    return `/posts?${params}`;
  };

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError } =
    useInfiniteQuery({
      queryKey: ['feed', filter, startDate, endDate],
      queryFn: ({ pageParam }) =>
        api.get<{ posts: Post[]; nextCursor: string | null; hasMore: boolean }>(
          buildQuery(pageParam as string | undefined)
        ),
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : undefined),
      // Poll every 15 seconds so new posts appear without WebSockets
      refetchInterval: 15_000,
      refetchIntervalInBackground: false,
    });

  useEffect(() => {
    if (data?.pages[0]) {
      setPosts(data.pages[0].posts);
      for (let i = 1; i < data.pages.length; i++) {
        appendPosts(data.pages[i].posts);
      }
    }
  }, [data, setPosts, appendPosts]);

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage]
  );

  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(handleObserver, { threshold: 0.1 });
    if (loadMoreRef.current) observerRef.current.observe(loadMoreRef.current);
    return () => observerRef.current?.disconnect();
  }, [handleObserver]);

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

  if (!posts.length) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        No posts yet. Be the first to pulse!
      </div>
    );
  }

  return (
    <div>
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
      <div ref={loadMoreRef} className="h-10" />
      {isFetchingNextPage && (
        <div className="p-4 text-center text-sm text-muted-foreground">Loading more...</div>
      )}
    </div>
  );
}
