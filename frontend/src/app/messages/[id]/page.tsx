'use client';

import { use, useState, useEffect, useRef, useCallback } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft, Send, Smile } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { EmojiPickerPopover } from '@/components/ui/emoji-picker-popover';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { formatRelativeTime } from '@/lib/utils';
import type { DirectMessage, DMConversation } from '@/types';

interface MessagesResponse {
  messages: DirectMessage[];
  nextCursor: string | null;
  hasMore: boolean;
}

// Group messages: consecutive messages from the same sender within 2 min = one group
function groupMessages(messages: DirectMessage[]) {
  const groups: { senderId: string; fromMe: boolean; msgs: DirectMessage[] }[] = [];
  for (const msg of messages) {
    const last = groups[groups.length - 1];
    const timeDiff = last?.msgs.length
      ? new Date(msg.createdAt).getTime() - new Date(last.msgs[last.msgs.length - 1].createdAt).getTime()
      : Infinity;
    if (last && last.senderId === msg.senderId && timeDiff < 2 * 60 * 1000) {
      last.msgs.push(msg);
    } else {
      groups.push({ senderId: msg.senderId, fromMe: msg.fromMe, msgs: [msg] });
    }
  }
  return groups;
}

export default function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isFirstLoad = useRef(true);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['dm-messages', id],
    queryFn: ({ pageParam }) =>
      api.get<MessagesResponse>(
        pageParam ? `/dm/${id}?cursor=${pageParam}` : `/dm/${id}`,
        accessToken ?? undefined
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => (last.hasMore ? last.nextCursor : undefined),
    enabled: !!accessToken,
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });

  // Pull conversation partner from cache
  const convCache = queryClient.getQueryData<{ conversations: DMConversation[] }>(['conversations']);
  const conv = convCache?.conversations.find((c) => c.id === id);

  const allMessages = data?.pages.flatMap((p) => p.messages) ?? [];
  const groups = groupMessages(allMessages);

  // Scroll to bottom on first load only
  useEffect(() => {
    if (data && isFirstLoad.current) {
      isFirstLoad.current = false;
      bottomRef.current?.scrollIntoView();
    }
  }, [data]);

  // Scroll to bottom on new sent message
  const scrollToBottom = useCallback(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
  }, []);

  const send = useMutation({
    mutationFn: (content: string) =>
      api.post<{ message: DirectMessage }>(`/dm/${id}`, { content }, accessToken ?? undefined),
    onSuccess: (res) => {
      queryClient.setQueryData(
        ['dm-messages', id],
        (old: { pages: MessagesResponse[]; pageParams: unknown[] } | undefined) => {
          if (!old) return old;
          const pages = [...old.pages];
          const last = pages[pages.length - 1];
          pages[pages.length - 1] = { ...last, messages: [...last.messages, res.message] };
          return { ...old, pages };
        }
      );
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      setText('');
      scrollToBottom();
    },
  });

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || send.isPending) return;
    send.mutate(trimmed);
  };

  // Determine if a time divider should appear before a group
  function shouldShowTime(groupIndex: number) {
    if (groupIndex === 0) return true;
    const prev = groups[groupIndex - 1].msgs;
    const cur = groups[groupIndex].msgs;
    return new Date(cur[0].createdAt).getTime() - new Date(prev[prev.length - 1].createdAt).getTime() > 5 * 60 * 1000;
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-background">
      {/* Header */}
      <div
        className="flex shrink-0 items-center gap-3 border-b border-border bg-background/90 px-3 py-3 backdrop-blur"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0px))' }}
      >
        <Link href="/messages" className="shrink-0 rounded-full p-1 hover:bg-border/50">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        {conv ? (
          <Link href={`/profile/${conv.other.username}`} className="flex min-w-0 flex-1 items-center gap-2.5 hover:opacity-80">
            <Avatar src={conv.other.avatarUrl} alt={conv.other.username} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-tight">
                {conv.other.displayName ?? conv.other.username}
              </p>
              <p className="truncate text-xs text-muted-foreground">@{conv.other.username}</p>
            </div>
          </Link>
        ) : (
          <p className="font-semibold">Conversation</p>
        )}
      </div>

      {/* Message list — flex-col so oldest at top, newest at bottom */}
      <div ref={listRef} className="flex flex-1 flex-col overflow-y-auto px-3 py-3 sm:px-4">
        {/* Load older */}
        {hasNextPage && (
          <div className="mb-3 flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="rounded-full text-xs text-muted-foreground"
            >
              {isFetchingNextPage ? 'Loading...' : '↑ Load older messages'}
            </Button>
          </div>
        )}

        {groups.map((group, gi) => (
          <div key={group.msgs[0].id}>
            {/* Time divider */}
            {shouldShowTime(gi) && (
              <p className="my-3 text-center text-xs text-muted-foreground">
                {formatRelativeTime(group.msgs[0].createdAt)}
              </p>
            )}

            {/* Message group */}
            <div className={`mb-1 flex flex-col gap-0.5 ${group.fromMe ? 'items-end' : 'items-start'}`}>
              {group.msgs.map((msg, mi) => {
                const isFirst = mi === 0;
                const isLast = mi === group.msgs.length - 1;
                return (
                  <MessageBubble
                    key={msg.id}
                    msg={msg}
                    fromMe={group.fromMe}
                    isFirst={isFirst}
                    isLast={isLast}
                    onEmojiSend={(emoji) => send.mutate(emoji)}
                  />
                );
              })}
              {/* Read receipt on last message from me */}
              {group.fromMe && group.msgs[group.msgs.length - 1].readAt && (
                <p className="mr-1 text-[10px] text-muted-foreground">Read</p>
              )}
            </div>
          </div>
        ))}

        {!allMessages.length && !isFetchingNextPage && (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Say hello 👋
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div
        className="shrink-0 border-t border-border bg-background px-3 py-2 sm:px-4"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="flex items-center gap-2">
          {/* Emoji picker trigger */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setShowEmoji((v) => !v)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-border/50 hover:text-twitter-blue"
              aria-label="Add emoji"
            >
              <Smile className="h-5 w-5" />
            </button>
            <EmojiPickerPopover
              open={showEmoji}
              onClose={() => setShowEmoji(false)}
              onSelect={(emoji) => {
                setText((t) => t + emoji);
                setShowEmoji(false);
                inputRef.current?.focus();
              }}
            />
          </div>

          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
            }}
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

// --- MessageBubble component ---
function MessageBubble({
  msg,
  fromMe,
  isFirst,
  isLast,
  onEmojiSend,
}: {
  msg: DirectMessage;
  fromMe: boolean;
  isFirst: boolean;
  isLast: boolean;
  onEmojiSend: (emoji: string) => void;
}) {
  const [showPicker, setShowPicker] = useState(false);

  // Bubble shape: first/last of group get different radii like iMessage
  const bubbleRadius = fromMe
    ? `rounded-2xl ${isFirst ? 'rounded-tr-md' : ''} ${isLast ? 'rounded-br-sm' : ''}`
    : `rounded-2xl ${isFirst ? 'rounded-tl-md' : ''} ${isLast ? 'rounded-bl-sm' : ''}`;

  return (
    <div className={`group relative flex items-end gap-1 ${fromMe ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className={`relative max-w-[75vw] sm:max-w-[65%] ${bubbleRadius} px-3 py-2 text-sm leading-relaxed break-words ${
        fromMe ? 'bg-twitter-blue text-white' : 'bg-card text-foreground'
      }`}>
        {msg.content}
      </div>

      {/* React button — appears on hover */}
      <div className="relative opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={() => setShowPicker((v) => !v)}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm hover:text-twitter-blue"
          aria-label="React"
        >
          <Smile className="h-3.5 w-3.5" />
        </button>
        <EmojiPickerPopover
          open={showPicker}
          onClose={() => setShowPicker(false)}
          onSelect={(emoji) => { onEmojiSend(emoji); setShowPicker(false); }}
        />
      </div>
    </div>
  );
}
