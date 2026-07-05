'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import type { TrendingHashtag, Post } from '@/types';

export function RightSidebar() {
  const { data: trending } = useQuery({
    queryKey: ['trending'],
    queryFn: () => api.get<{ hashtags: TrendingHashtag[] }>('/search/trending'),
    refetchInterval: 60_000,
  });

  const { data: threads } = useQuery({
    queryKey: ['recent-threads'],
    queryFn: () => api.get<{ threads: Post[] }>('/search/recent-threads'),
    refetchInterval: 30_000,
  });

  return (
    <aside className="sticky top-0 hidden h-screen w-[350px] space-y-4 overflow-y-auto py-2 xl:block">
      <Card className="p-4">
        <h2 className="mb-3 text-xl font-bold">Trending</h2>
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
        <h2 className="mb-3 text-xl font-bold">Recent Threads</h2>
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
