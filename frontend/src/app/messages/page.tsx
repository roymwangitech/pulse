'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Search, MessageCircle } from 'lucide-react';
import { AppLayout } from '@/components/layout/app-layout';
import { PageHeader } from '@/components/layout/page-header';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { formatRelativeTime } from '@/lib/utils';
import type { DMConversation } from '@/types';

export default function MessagesPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [newUsername, setNewUsername] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [newError, setNewError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => api.get<{ conversations: DMConversation[] }>('/dm', accessToken ?? undefined),
    enabled: !!accessToken,
    refetchInterval: 30_000,
  });

  const startConv = useMutation({
    mutationFn: (username: string) =>
      api.post<{ conversation: { id: string; other: DMConversation['other'] } }>('/dm', { username }, accessToken ?? undefined),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      router.push(`/messages/${res.conversation.id}`);
    },
    onError: (e) => setNewError((e as Error).message),
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

      <div className="border-b border-border p-3">
        {showNew ? (
          <div className="flex gap-2">
            <Input
              placeholder="Username to message..."
              value={newUsername}
              onChange={(e) => { setNewUsername(e.target.value); setNewError(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter' && newUsername.trim()) startConv.mutate(newUsername.trim()); }}
              autoFocus
              className="flex-1"
            />
            <Button
              onClick={() => { if (newUsername.trim()) startConv.mutate(newUsername.trim()); }}
              disabled={!newUsername.trim() || startConv.isPending}
              size="sm"
            >
              {startConv.isPending ? '...' : 'Go'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setShowNew(false); setNewUsername(''); setNewError(''); }}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button onClick={() => setShowNew(true)} className="w-full gap-2" variant="outline">
            <Search className="h-4 w-4" />
            New message
          </Button>
        )}
        {newError && <p className="mt-1 text-xs text-red-500">{newError}</p>}
      </div>

      {isLoading && (
        <div className="space-y-1 p-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-card" />
          ))}
        </div>
      )}

      {!isLoading && !data?.conversations.length && (
        <div className="flex flex-col items-center gap-3 p-12 text-center text-muted-foreground">
          <MessageCircle className="h-10 w-10 opacity-30" />
          <p>No messages yet. Start a conversation!</p>
        </div>
      )}

      <div>
        {data?.conversations.map((conv) => (
          <button
            key={conv.id}
            type="button"
            onClick={() => router.push(`/messages/${conv.id}`)}
            className="flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left transition-colors hover:bg-card/50"
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
                <span className={`truncate text-sm font-semibold ${conv.unread > 0 ? '' : 'text-foreground'}`}>
                  {conv.other.displayName ?? conv.other.username}
                </span>
                {conv.lastMessage && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatRelativeTime(conv.lastMessage.createdAt)}
                  </span>
                )}
              </div>
              {conv.lastMessage && (
                <p className={`truncate text-sm ${conv.unread > 0 ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                  {conv.lastMessage.fromMe ? 'You: ' : ''}{conv.lastMessage.content}
                </p>
              )}
            </div>
          </button>
        ))}
      </div>
    </AppLayout>
  );
}
