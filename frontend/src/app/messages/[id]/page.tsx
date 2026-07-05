'use client';

import { use, useState, useEffect, useRef } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft, Send } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { formatRelativeTime } from '@/lib/utils';
import type { DirectMessage, DMConversation } from '@/types';

interface MessagesResponse {
  messages: DirectMessage[];
  nextCursor: string | null;
  hasMore: boolean;
}

interface ConvMeta { other: DMConversation['other'] }

export default function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['dm-messages', id],
    queryFn: ({ pageParam }) => {
      const url = pageParam ? `/dm/${id}?cursor=${pageParam}` : `/dm/${id}`;
      return api.get<MessagesResponse>(url, accessToken ?? undefined);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => (last.hasMore ? last.nextCursor : undefined),
    enabled: !!accessToken,
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });

  // Derive conversation partner from first page
  const convMeta = queryClient.getQueryData<{ conversations: DMConversation[] }>(['conversations']);
  const conv = convMeta?.conversations.find((c) => c.id === id);

  const allMessages = data?.pages.flatMap((p) => p.messages) ?? [];

  // Scroll to bottom on new messages (first load + sends)
  useEffect(() => {
    if (data?.pages.length === 1) {
      bottomRef.current?.scrollIntoView();
    }
  }, [data?.pages.length]);

  const send = useMutation({
    mutationFn: (content: string) =>
      api.post<{ message: DirectMessage }>(`/dm/${id}`, { content }, accessToken ?? undefined),
    onSuccess: (res) => {
      queryClient.setQueryData(['dm-messages', id], (old: { pages: MessagesResponse[]; pageParams: unknown[] } | undefined) => {
        if (!old) return old;
        const pages = [...old.pages];
        pages[pages.length - 1] = {
          ...pages[pages.length - 1],
          messages: [...pages[pages.length - 1].messages, res.message],
        };
        return { ...old, pages };
      });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      setText('');
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    },
  });

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || send.isPending) return;
    send.mutate(trimmed);
  };

  return (
    <div className="flex h-[100dvh] flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border bg-background/80 px-3 py-3 backdrop-blur"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0px))' }}>
        <Link href="/messages" className="shrink-0 rounded-full p-1 hover:bg-border/50">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        {conv ? (
          <Link href={`/profile/${conv.other.username}`} className="flex items-center gap-2 hover:underline">
            <Avatar src={conv.other.avatarUrl} alt={conv.other.username} size="sm" />
            <div className="min-w-0">
              <p className="truncate font-semibold leading-tight">{conv.other.displayName ?? conv.other.username}</p>
              <p className="truncate text-xs text-muted-foreground">@{conv.other.username}</p>
            </div>
          </Link>
        ) : (
          <p className="font-semibold">Conversation</p>
        )}
      </div>

      {/* Messages */}
      <div className="flex flex-1 flex-col-reverse overflow-y-auto px-3 py-2 sm:px-4">
        <div ref={bottomRef} />

        {allMessages.map((msg, i) => {
          const prev = allMessages[i - 1];
          const showTime = !prev || new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime() > 5 * 60 * 1000;
          return (
            <div key={msg.id}>
              {showTime && (
                <p className="my-2 text-center text-xs text-muted-foreground">
                  {formatRelativeTime(msg.createdAt)}
                </p>
              )}
              <div className={`mb-1 flex ${msg.fromMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm leading-relaxed break-words ${
                  msg.fromMe
                    ? 'rounded-br-sm bg-twitter-blue text-white'
                    : 'rounded-bl-sm bg-card text-foreground'
                }`}>
                  {msg.content}
                </div>
              </div>
            </div>
          );
        })}

        {hasNextPage && (
          <div className="mb-2 flex justify-center">
            <Button variant="ghost" size="sm" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}
              className="text-xs text-muted-foreground">
              {isFetchingNextPage ? 'Loading...' : 'Load older messages'}
            </Button>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-border bg-background px-3 py-2 sm:px-4"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))' }}>
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Message..."
            maxLength={1000}
            className="flex-1 rounded-full border border-border bg-card px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-twitter-blue"
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!text.trim() || send.isPending}
            className="h-9 w-9 shrink-0 rounded-full"
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
