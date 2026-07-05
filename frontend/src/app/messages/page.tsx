'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { MessageCircle, Users, Search } from 'lucide-react';
import { AppLayout } from '@/components/layout/app-layout';
import { PageHeader } from '@/components/layout/page-header';
import { Avatar } from '@/components/ui/avatar';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { formatRelativeTime } from '@/lib/utils';
import type { DMConversation, DMUser } from '@/types';

type Tab = 'chats' | 'people';

export default function MessagesPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('chats');
  const [search, setSearch] = useState('');

  const { data: convData, isLoading: loadingConvs } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => api.get<{ conversations: DMConversation[] }>('/dm', accessToken ?? undefined),
    enabled: !!accessToken,
    refetchInterval: 30_000,
  });

  const { data: usersData, isLoading: loadingUsers } = useQuery({
    queryKey: ['dm-users', search],
    queryFn: () => api.get<{ users: DMUser[] }>(`/dm/users${search ? `?q=${encodeURIComponent(search)}` : ''}`, accessToken ?? undefined),
    enabled: !!accessToken && tab === 'people',
  });

  const startConv = useMutation({
    mutationFn: (username: string) =>
      api.post<{ conversation: { id: string } }>('/dm', { username }, accessToken ?? undefined),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      router.push(`/messages/${res.conversation.id}`);
    },
  });

  if (!accessToken) {
    return (
      <AppLayout>
        <div className="p-8 text-center text-muted-foreground">
          <a href="/login" className="text-twitter-blue hover:underline">Sign in</a> to view messages
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader title="Messages" />

      {/* Tab bar */}
      <div className="flex border-b border-border">
        {(['chats', 'people'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex flex-1 items-center justify-center gap-2 py-3 text-sm font-medium transition-colors capitalize
              ${tab === t ? 'border-b-2 border-twitter-blue text-twitter-blue' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {t === 'chats' ? <MessageCircle className="h-4 w-4" /> : <Users className="h-4 w-4" />}
            {t}
          </button>
        ))}
      </div>

      {/* Search bar — shown on People tab */}
      {tab === 'people' && (
        <div className="border-b border-border p-3">
          <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search people..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>
      )}

      {/* Chats tab */}
      {tab === 'chats' && (
        <>
          {loadingConvs && (
            <div className="space-y-px p-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-card" />
              ))}
            </div>
          )}

          {!loadingConvs && !convData?.conversations.length && (
            <div className="flex flex-col items-center gap-3 p-12 text-center text-muted-foreground">
              <MessageCircle className="h-10 w-10 opacity-30" />
              <p className="text-sm">No chats yet.</p>
              <button type="button" onClick={() => setTab('people')} className="text-sm text-twitter-blue hover:underline">
                Find someone to message →
              </button>
            </div>
          )}

          {convData?.conversations.map((conv) => (
            <button
              key={conv.id}
              type="button"
              onClick={() => router.push(`/messages/${conv.id}`)}
              className="flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left transition-colors hover:bg-card/50 active:bg-card"
            >
              <div className="relative shrink-0">
                <Avatar src={conv.other.avatarUrl} alt={conv.other.username} size="md" />
                {conv.unread > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-twitter-blue text-[10px] font-bold text-white">
                    {conv.unread > 9 ? '9+' : conv.unread}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-semibold">
                    {conv.other.displayName ?? conv.other.username}
                  </span>
                  {conv.lastMessage && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatRelativeTime(conv.lastMessage.createdAt)}
                    </span>
                  )}
                </div>
                <p className={`truncate text-sm ${conv.unread > 0 ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                  {conv.lastMessage
                    ? `${conv.lastMessage.fromMe ? 'You: ' : ''}${conv.lastMessage.content}`
                    : <span className="italic">No messages yet</span>}
                </p>
              </div>
            </button>
          ))}
        </>
      )}

      {/* People tab */}
      {tab === 'people' && (
        <>
          {loadingUsers && (
            <div className="space-y-px p-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-xl bg-card" />
              ))}
            </div>
          )}

          {!loadingUsers && !usersData?.users.length && (
            <div className="p-12 text-center text-sm text-muted-foreground">
              {search ? `No users matching "${search}"` : 'No other users yet'}
            </div>
          )}

          {usersData?.users.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => startConv.mutate(u.username)}
              disabled={startConv.isPending}
              className="flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left transition-colors hover:bg-card/50 active:bg-card disabled:opacity-60"
            >
              <Avatar src={u.avatarUrl} alt={u.username} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{u.displayName ?? u.username}</p>
                <p className="truncate text-xs text-muted-foreground">@{u.username}</p>
              </div>
              <MessageCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </>
      )}
    </AppLayout>
  );
}
