'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import type { TrendingHashtag, Post, OnlineUsers } from '@/types';
import { useEffect, useState } from 'react';
import { getSocket } from '@/lib/socket';
import { useAuthStore } from '@/stores/auth';

export function RightSidebar() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUsers>({ count: 0, users: [] });

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

  useEffect(() => {
    const socket = getSocket(accessToken ?? undefined);
    socket.on('users:online', (data: OnlineUsers) => setOnlineUsers(data));
    return () => { socket.off('users:online'); };
  }, [accessToken]);

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
        <h2 className="mb-3 text-xl font-bold">Active Now</h2>
        <p className="mb-2 text-sm text-muted-foreground">{onlineUsers.count} online</p>
        <div className="flex flex-wrap gap-2">
          {onlineUsers.users.slice(0, 8).map((u) => (
            <Link key={u.userId} href={`/profile/${u.username}`} title={u.username}>
              <div className="h-8 w-8 rounded-full bg-twitter-blue/20 flex items-center justify-center text-xs font-bold">
                {u.username[0].toUpperCase()}
              </div>
            </Link>
          ))}
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
