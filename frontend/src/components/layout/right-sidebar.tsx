'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import type { TrendingHashtag, Post } from '@/types';

export function RightSidebar() {
  const { data: trending, refetch: refetchTrending, isFetching: fetchingTrending } = useQuery({
    queryKey: ['trending'],
    queryFn: () => api.get<{ hashtags: TrendingHashtag[] }>('/search/trending'),
    staleTime: 5 * 60_000, // consider fresh for 5 minutes
  });

  const { data: threads, refetch: refetchThreads, isFetching: fetchingThreads } = useQuery({
    queryKey: ['recent-threads'],
    queryFn: () => api.get<{ threads: Post[] }>('/search/recent-threads'),
    staleTime: 2 * 60_000,
  });

  return (
    <aside className="sticky top-0 hidden h-screen w-[350px] space-y-4 overflow-y-auto py-2 xl:block">
      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-bold">Trending</h2>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => refetchTrending()}
            disabled={fetchingTrending}
            aria-label="Refresh trending"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${fetchingTrending ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        <div className="space-y-3">
          {trending?.hashtags.map((tag) => (
            <Link key={tag.name} href={`/explore?q=%23${tag.name}`} className="block hover:bg-border/30 rounded-lg p-2 -mx-2">
              <p className="text-sm text-muted-foreground">#{tag.name}</p>
              <p className="font-semibold">{tag.postCount} posts</p>
            </Link>
          ))}
          {!trending?.hashtags.length && (
            <p className="text-sm text-muted-foreground">No trending hashtags yet</p>
          )}
        </div>
      </Card>

      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-bold">Recent Threads</h2>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => refetchThreads()}
            disabled={fetchingThreads}
            aria-label="Refresh threads"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${fetchingThreads ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        <div className="space-y-3">
          {threads?.threads.map((thread) => (
            <Link key={thread.id} href={`/post/${thread.id}`} className="flex gap-3 hover:bg-border/30 rounded-lg p-2 -mx-2">
              <Avatar src={thread.user.avatarUrl} alt={thread.user.username} size="sm" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">@{thread.user.username}</p>
                <p className="text-xs text-muted-foreground">{thread.replyCount} replies</p>
              </div>
            </Link>
          ))}
          {!threads?.threads.length && (
            <p className="text-sm text-muted-foreground">No active threads</p>
          )}
        </div>
      </Card>
    </aside>
  );
}
