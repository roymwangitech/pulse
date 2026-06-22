'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { PageHeader } from '@/components/layout/page-header';
import { Avatar } from '@/components/ui/avatar';
import { api } from '@/lib/api';
import type { Post } from '@/types';

export default function ThreadsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['recent-threads'],
    queryFn: () => api.get<{ threads: Post[] }>('/search/recent-threads'),
  });

  return (
    <AppLayout>
      <PageHeader title="Threads" />
      <div className="divide-y divide-border">
        {isLoading && (
          <div className="p-8 text-center text-muted-foreground">Loading threads...</div>
        )}
        {data?.threads.map((thread) => (
          <Link key={thread.id} href={`/post/${thread.id}`} className="flex gap-3 p-4 hover:bg-card/50">
            <Avatar src={thread.user.avatarUrl} alt={thread.user.username} />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{thread.user.displayName ?? thread.user.username}</p>
              <p className="text-sm text-muted-foreground">@{thread.user.username}</p>
              {thread.caption && <p className="mt-1 truncate">{thread.caption}</p>}
              <p className="mt-1 text-sm text-twitter-blue">{thread.replyCount} replies</p>
            </div>
          </Link>
        ))}
        {!isLoading && !data?.threads.length && (
          <div className="p-8 text-center text-muted-foreground">No active threads yet</div>
        )}
      </div>
    </AppLayout>
  );
}
