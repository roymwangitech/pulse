'use client';

import { use, useState, useEffect, useRef, useCallback } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft, Send, Smile, CornerUpLeft, X } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { EmojiPickerPopover } from '@/components/ui/emoji-picker-popover';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { formatRelativeTime } from '@/lib/utils';
import { playNotificationSound } from '@/lib/notification-sound';
import type { DirectMessage, DMConversation } from '@/types';

const MAX_CHARS = 3000;

interface MessagesResponse {
  messages: DirectMessage[];
  nextCursor: string | null;
  hasMore: boolean;
}

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
  const me = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [replyTo, setReplyTo] = useState<DirectMessage | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isFirstLoad = useRef(true);
  const prevMessageCount = useRef(0);

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

  const convCache = queryClient.getQueryData<{ conversations: DMConversation[] }>(['conversations']);
  const conv = convCache?.conversations.find((c) => c.id === id);

  const allMessages = data?.pages.flatMap((p) => p.messages) ?? [];
  const groups = groupMessages(allMessages);

  // First load scroll
  useEffect(() => {
    if (data && isFirstLoad.current) {
      isFirstLoad.current = false;
      prevMessageCount.current = allMessages.length;
      bottomRef.current?.scrollIntoView();
    }
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  // Play sound + scroll on new incoming message
  useEffect(() => {
    const count = allMessages.length;
    if (count > prevMessageCount.current && !isFirstLoad.current) {
      const newest = allMessages[count - 1];
      if (newest && !newest.fromMe) {
        playNotificationSound();
      }
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevMessageCount.current = count;
  }, [allMessages.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const scrollToBottom = useCallback(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
  }, []);

  const send = useMutation({
    mutationFn: ({ content, replyToId }: { content: string; replyToId?: string }) =>
      api.post<{ message: DirectMessage }>(`/dm/${id}`, { content, replyToId }, accessToken ?? undefined),
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
      setReplyTo(null);
      scrollToBottom();
    },
  });

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || send.isPending) return;
    send.mutate({ content: trimmed, replyToId: replyTo?.id });
  };

  // Auto-resize textarea
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  };

  function shouldShowTime(gi: number) {
    if (gi === 0) return true;
    const prev = groups[gi - 1].msgs;
    const cur = groups[gi].msgs;
    return new Date(cur[0].createdAt).getTime() - new Date(prev[prev.length - 1].createdAt).getTime() > 5 * 60 * 1000;
  }

  const charsLeft = MAX_CHARS - text.length;
  const nearLimit = charsLeft <= 200;

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
              <p className="truncate text-sm font-semibold leading-tight">{conv.other.displayName ?? conv.other.username}</p>
              <p className="truncate text-xs text-muted-foreground">@{conv.other.username}</p>
            </div>
          </Link>
        ) : (
          <p className="font-semibold">Conversation</p>
        )}
      </div>

      {/* Messages */}
      <div className="flex flex-1 flex-col overflow-y-auto px-3 py-3 sm:px-4">
        {hasNextPage && (
          <div className="mb-3 flex justify-center">
            <Button variant="ghost" size="sm" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}
              className="rounded-full text-xs text-muted-foreground">
              {isFetchingNextPage ? 'Loading...' : '↑ Load older messages'}
            </Button>
          </div>
        )}

        {groups.map((group, gi) => (
          <div key={group.msgs[0].id}>
            {shouldShowTime(gi) && (
              <p className="my-3 text-center text-xs text-muted-foreground">
                {formatRelativeTime(group.msgs[0].createdAt)}
              </p>
            )}
            <div className={`mb-1 flex flex-col gap-0.5 ${group.fromMe ? 'items-end' : 'items-start'}`}>
              {group.msgs.map((msg, mi) => (
                <MessageBubble
                  key={msg.id}
                  msg={msg}
                  fromMe={group.fromMe}
                  isFirst={mi === 0}
                  isLast={mi === group.msgs.length - 1}
                  onReply={() => { setReplyTo(msg); textareaRef.current?.focus(); }}
                  onEmojiSend={(emoji) => send.mutate({ content: emoji })}
                />
              ))}
              {group.fromMe && group.msgs[group.msgs.length - 1].readAt && (
                <p className="mr-1 text-[10px] text-muted-foreground">Read</p>
              )}
            </div>
          </div>
        ))}

        {!allMessages.length && (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Say hello 👋
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div
        className="shrink-0 border-t border-border bg-background px-3 py-2 sm:px-4"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))' }}
      >
        {/* Reply preview */}
        {replyTo && (
          <div className="mb-2 flex items-start gap-2 rounded-xl border border-border bg-card/50 px-3 py-2">
            <CornerUpLeft className="mt-0.5 h-3.5 w-3.5 shrink-0 text-twitter-blue" />
            <p className="flex-1 truncate text-xs text-muted-foreground">
              {replyTo.fromMe ? 'You' : conv?.other.username}: {replyTo.content}
            </p>
            <button type="button" onClick={() => setReplyTo(null)} className="shrink-0 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <div className="flex items-end gap-2">
          {/* Emoji */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setShowEmoji((v) => !v)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-border/50 hover:text-twitter-blue"
              aria-label="Add emoji"
            >
              <Smile className="h-5 w-5" />
            </button>
            <EmojiPickerPopover
              open={showEmoji}
              onClose={() => setShowEmoji(false)}
              onSelect={(emoji) => { setText((t) => t + emoji); setShowEmoji(false); textareaRef.current?.focus(); }}
            />
          </div>

          {/* Textarea — grows with content, max ~4 lines */}
          <div className="relative flex-1">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={handleChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
                // Shift+Enter inserts newline (default textarea behaviour, nothing to override)
              }}
              placeholder="Message… (Shift+Enter for new line)"
              maxLength={MAX_CHARS}
              rows={1}
              className="max-h-40 w-full resize-none rounded-2xl border border-border bg-card px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-twitter-blue"
              style={{ overflowY: 'auto' }}
            />
            {nearLimit && (
              <span className={`absolute bottom-2 right-3 text-[10px] tabular-nums ${charsLeft < 0 ? 'text-red-500' : charsLeft < 50 ? 'text-yellow-500' : 'text-muted-foreground'}`}>
                {charsLeft}
              </span>
            )}
          </div>

          <Button
            size="icon"
            onClick={handleSend}
            disabled={!text.trim() || send.isPending || charsLeft < 0}
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

// MessageBubble
function MessageBubble({
  msg, fromMe, isFirst, isLast, onReply, onEmojiSend,
}: {
  msg: DirectMessage;
  fromMe: boolean;
  isFirst: boolean;
  isLast: boolean;
  onReply: () => void;
  onEmojiSend: (emoji: string) => void;
}) {
  const [showPicker, setShowPicker] = useState(false);

  const bubbleRadius = fromMe
    ? `rounded-2xl ${isFirst ? 'rounded-tr-md' : ''} ${isLast ? 'rounded-br-sm' : ''}`
    : `rounded-2xl ${isFirst ? 'rounded-tl-md' : ''} ${isLast ? 'rounded-bl-sm' : ''}`;

  return (
    <div className={`group flex w-full items-end gap-1 ${fromMe ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Bubble — capped width */}
      <div className={`${bubbleRadius} max-w-[min(75vw,480px)] px-3 py-2 text-sm leading-relaxed break-words whitespace-pre-wrap ${
        fromMe ? 'bg-twitter-blue text-white' : 'bg-card text-foreground'
      }`}>
        {/* Quoted reply preview */}
        {msg.replyTo && (
          <div className={`mb-1.5 rounded-lg border-l-2 pl-2 pr-1 py-1 text-xs opacity-80 ${
            fromMe ? 'border-white/50 bg-white/10' : 'border-twitter-blue/50 bg-border/50'
          }`}>
            <p className="truncate">{msg.replyTo.content}</p>
          </div>
        )}
        {msg.content}
      </div>

      {/* Actions — show on hover */}
      <div className={`flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 ${fromMe ? 'flex-row-reverse' : ''}`}>
        <button type="button" onClick={onReply}
          className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:text-twitter-blue"
          aria-label="Reply">
          <CornerUpLeft className="h-3.5 w-3.5" />
        </button>
        <div className="relative">
          <button type="button" onClick={() => setShowPicker((v) => !v)}
            className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:text-twitter-blue"
            aria-label="React">
            <Smile className="h-3.5 w-3.5" />
          </button>
          <EmojiPickerPopover
            open={showPicker}
            onClose={() => setShowPicker(false)}
            onSelect={(emoji) => { onEmojiSend(emoji); setShowPicker(false); }}
          />
        </div>
      </div>
    </div>
  );
}
