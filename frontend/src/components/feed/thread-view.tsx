'use client';

import { useState, useRef, useCallback } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft, ChevronDown, Pencil, Trash2, Check, X, Smile, ImagePlus } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { PostCard } from '@/components/feed/post-card';
import { EmojiPickerPopover } from '@/components/ui/emoji-picker-popover';
import { ImageViewer } from '@/components/ui/image-viewer';
import { formatRelativeTime, getProxiedUrl } from '@/lib/utils';
import { compressImage } from '@/lib/image';
import type { Post, ThreadReply } from '@/types';

const REPLIES_PAGE_SIZE = 15;
const CHILD_REPLIES_PAGE_SIZE = 10;
const MAX_CHARS = 2000;

async function uploadFile(file: File, token: string): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? 'Upload failed');
  }
  const data = await res.json() as { url: string };
  return data.url;
}

function renderCaption(text: string) {
  const parts = text.split(/(#[\w\u00C0-\u024F]+|https?:\/\/[^\s]+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('#')) {
      return (
        <Link key={i} href={`/explore?q=${encodeURIComponent(part)}`} className="text-twitter-blue hover:underline" onClick={(e) => e.stopPropagation()}>
          {part}
        </Link>
      );
    }
    if (/^https?:\/\//.test(part)) {
      return (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-twitter-blue hover:underline break-all" onClick={(e) => e.stopPropagation()}>
          {part}
        </a>
      );
    }
    return part;
  });
}

interface ThreadRepliesResponse {
  replies: ThreadReply[];
  nextCursor: string | null;
  hasMore: boolean;
  total: number;
}

function buildThreadUrl(postId: string, parentReplyId?: string, cursor?: string) {
  const params = new URLSearchParams({ limit: String(REPLIES_PAGE_SIZE) });
  if (parentReplyId) params.set('parentReplyId', parentReplyId);
  if (cursor) params.set('cursor', cursor);
  return `/threads/${postId}?${params}`;
}

function buildChildThreadUrl(postId: string, parentReplyId: string, cursor?: string) {
  const params = new URLSearchParams({ limit: String(CHILD_REPLIES_PAGE_SIZE), parentReplyId });
  if (cursor) params.set('cursor', cursor);
  return `/threads/${postId}?${params}`;
}

function ReplyItem({ reply, postId, depth = 0 }: { reply: ThreadReply; postId: string; depth?: number }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const me = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');
  const [showReply, setShowReply] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(reply.content);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [deleted, setDeleted] = useState(false);
  const [currentContent, setCurrentContent] = useState(reply.content);
  const [currentEditedAt, setCurrentEditedAt] = useState(reply.editedAt);
  const childTotal = reply.childCount ?? 0;
  const isOwner = me?.id === reply.user.id;

  const [showEmoji, setShowEmoji] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showReactPicker, setShowReactPicker] = useState(false);
  const [reacting, setReacting] = useState(false);

  const handleReaction = async (emoji: string) => {
    if (!accessToken || !me) return;
    setReacting(true);
    setShowReactPicker(false);
    try {
      const res = await api.post<{ action: string }>(
        `/reactions/replies/${reply.id}`,
        { emoji },
        accessToken
      );

      const updateReplies = (oldReplies: ThreadReply[]): ThreadReply[] => {
        return oldReplies.map((r) => {
          if (r.id === reply.id) {
            const reactions = [...r.reactions];
            const idx = reactions.findIndex((rx) => rx.emoji === emoji);
            if (res.action === 'added') {
              if (idx >= 0) {
                reactions[idx] = {
                  ...reactions[idx],
                  count: reactions[idx].count + 1,
                  userIds: [...(reactions[idx].userIds ?? []), me.id],
                };
              } else {
                reactions.push({ emoji, count: 1, userIds: [me.id] });
              }
            } else if (idx >= 0) {
              reactions[idx] = {
                ...reactions[idx],
                count: reactions[idx].count - 1,
                userIds: (reactions[idx].userIds ?? []).filter((uid) => uid !== me.id),
              };
              if (reactions[idx].count <= 0) {
                reactions.splice(idx, 1);
              }
            }
            return { ...r, reactions };
          }
          return r;
        });
      };

      if (reply.parentReplyId === null) {
        queryClient.setQueryData(
          ['thread', postId],
          (old: { pages: ThreadRepliesResponse[]; pageParams: unknown[] } | undefined) => {
            if (!old) return old;
            return {
              ...old,
              pages: old.pages.map((page) => ({
                ...page,
                replies: updateReplies(page.replies),
              })),
            };
          }
        );
      } else {
        queryClient.setQueryData(
          ['thread-children', postId, reply.parentReplyId],
          (old: { pages: ThreadRepliesResponse[]; pageParams: unknown[] } | undefined) => {
            if (!old) return old;
            return {
              ...old,
              pages: old.pages.map((page) => ({
                ...page,
                replies: updateReplies(page.replies),
              })),
            };
          }
        );
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setReacting(false);
    }
  };

  const [viewerOpen, setViewerOpen] = useState(false);

  const setImage = useCallback((file: File) => {
    if (file.size > 5 * 1024 * 1024) { setError('Image must be under 5MB'); return; }
    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
      setError('Only JPEG, PNG, GIF and WebP are allowed');
      return;
    }
    setImagePreview((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(file); });
    setImageFile(file);
    setError('');
  }, []);

  const clearImage = () => {
    setImageFile(null);
    setImagePreview((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
  };

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = Array.from(e.clipboardData.items);
    const imageItem = items.find((item) => item.type.startsWith('image/'));
    if (!imageItem) return;
    e.preventDefault();
    const file = imageItem.getAsFile();
    if (file) setImage(file);
  }, [setImage]);

  const { data: childData, fetchNextPage: fetchMoreChildren, hasNextPage: hasMoreChildren, isFetchingNextPage: loadingMoreChildren, isLoading: loadingChildren } =
    useInfiniteQuery({
      queryKey: ['thread-children', postId, reply.id],
      queryFn: ({ pageParam }) => api.get<ThreadRepliesResponse>(buildChildThreadUrl(postId, reply.id, pageParam as string | undefined)),
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : undefined),
      enabled: childTotal > 0,
    });

  const children = childData?.pages.flatMap((p) => p.replies) ?? [];
  const remainingChildren = Math.max(0, childTotal - children.length);

  const handleReply = async () => {
    if (!accessToken || (!content.trim() && !imageFile)) return;
    setLoading(true);
    setError('');
    try {
      let imageUrl: string | undefined;
      if (imageFile) {
        setUploading(true);
        const compressed = await compressImage(imageFile);
        imageUrl = await uploadFile(compressed, accessToken);
        setUploading(false);
      }

      const res = await api.post<{ reply: ThreadReply }>(
        `/threads/${postId}`,
        { content: content.trim(), imageUrl, parentReplyId: reply.id },
        accessToken
      );
      queryClient.setQueryData(
        ['thread-children', postId, reply.id],
        (old: { pages: ThreadRepliesResponse[]; pageParams: unknown[] } | undefined) => {
          if (!old) return { pages: [{ replies: [res.reply], nextCursor: null, hasMore: false, total: 1 }], pageParams: [undefined] };
          const pages = [...old.pages];
          const last = pages[pages.length - 1];
          pages[pages.length - 1] = { ...last, replies: [...last.replies, res.reply], total: last.total + 1 };
          return { ...old, pages };
        }
      );
      queryClient.invalidateQueries({ queryKey: ['thread', postId] });
      setContent('');
      clearImage();
      setShowEmoji(false);
      setShowReply(false);
    } catch (err) {
      setError((err as Error).message);
      setUploading(false);
    } finally {
      setLoading(false);
    }
  };

  const handleEditSave = async () => {
    if (!accessToken || !editContent.trim() || editContent.trim() === currentContent) {
      setEditing(false);
      return;
    }
    setEditSaving(true);
    setEditError('');
    try {
      const res = await api.patch<{ reply: ThreadReply }>(`/threads/reply/${reply.id}`, { content: editContent.trim() }, accessToken);
      setCurrentContent(res.reply.content);
      setCurrentEditedAt(res.reply.editedAt);
      setEditing(false);
    } catch (err) {
      setEditError((err as Error).message);
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!accessToken) return;
    try {
      await api.delete(`/threads/reply/${reply.id}`, accessToken);
      setDeleted(true);
    } catch {
      // silently ignore
    }
  };

  if (deleted) return null;

  const charsLeft = MAX_CHARS - content.length;
  const nearLimit = charsLeft <= 200;

  return (
    <div className={depth > 0 ? 'ml-3 border-l border-border pl-2 sm:ml-6 sm:pl-4' : ''}>
      <div className="flex gap-2 py-3 sm:gap-3">
        <Link href={`/profile/${reply.user.username}`}>
          <Avatar src={reply.user.avatarUrl} alt={reply.user.username} size="sm" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-sm">
            <span className="font-bold">{reply.user.displayName ?? reply.user.username}</span>
            <span className="text-muted-foreground">@{reply.user.username}</span>
            <span className="text-muted-foreground">· {formatRelativeTime(reply.createdAt)}</span>
            {currentEditedAt && (
              <span className="text-xs italic text-muted-foreground" title={`Edited ${formatRelativeTime(currentEditedAt)}`}>
                · edited
              </span>
            )}
            {isOwner && !editing && (
              <div className="ml-auto flex items-center gap-0.5">
                <button
                   type="button"
                   onClick={() => { setEditContent(currentContent); setEditing(true); }}
                   className="rounded p-1 text-muted-foreground hover:text-foreground"
                   aria-label="Edit reply"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="rounded p-1 text-muted-foreground hover:text-red-500"
                  aria-label="Delete reply"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          {editing ? (
            <div className="mt-2 space-y-1.5">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full resize-none rounded-lg border border-twitter-blue bg-card p-2 text-sm outline-none focus:ring-2 focus:ring-twitter-blue"
                rows={2}
                maxLength={2000}
                autoFocus
              />
              {editError && <p className="text-xs text-red-500">{editError}</p>}
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={handleEditSave}
                  disabled={editSaving || !editContent.trim()}
                  className="flex items-center gap-1 rounded-full bg-twitter-blue px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
                >
                  <Check className="h-3 w-3" />
                  {editSaving ? 'Saving...' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => { setEditing(false); setEditError(''); }}
                  className="flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs font-medium"
                >
                  <X className="h-3 w-3" />
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              {currentContent && currentContent.trim() && (
                <p className="mt-1 whitespace-pre-wrap break-words">{renderCaption(currentContent)}</p>
              )}
              {reply.imageUrl && (
                <div
                  className="mt-2 max-w-md overflow-hidden rounded-2xl border border-border"
                  onClick={(e) => e.stopPropagation()}
                >
                  <img
                    src={getProxiedUrl(reply.imageUrl)}
                    alt=""
                    loading="lazy"
                    className="max-h-[300px] w-full cursor-zoom-in object-cover transition-opacity hover:opacity-95"
                    onClick={() => setViewerOpen(true)}
                  />
                </div>
              )}
            </>
          )}

          {viewerOpen && reply.imageUrl && (
            <ImageViewer src={getProxiedUrl(reply.imageUrl)} onClose={() => setViewerOpen(false)} />
          )}

          {reply.reactions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
              {reply.reactions.map((r) => (
                <button
                  key={r.emoji} type="button"
                  onClick={() => handleReaction(r.emoji)}
                  disabled={reacting || !accessToken}
                  className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors ${
                    r.userIds?.includes(me?.id ?? '') ? 'border-twitter-blue bg-twitter-blue/20' : 'border-border hover:bg-border/50'
                  }`}
                >
                  <span>{r.emoji}</span>
                  <span className="text-xs">{r.count}</span>
                </button>
              ))}
            </div>
          )}

          <div className="mt-2 flex items-center gap-3">
            {depth < 4 && accessToken && (
              <button
                type="button"
                onClick={() => setShowReply(!showReply)}
                className="text-sm text-twitter-blue hover:underline"
              >
                Reply
              </button>
            )}

            {accessToken && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowReactPicker(!showReactPicker)}
                  disabled={reacting}
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-twitter-blue"
                  aria-label="React with emoji"
                >
                  <Smile className="h-3.5 w-3.5" />
                  <span>React</span>
                </button>
                <EmojiPickerPopover
                  open={showReactPicker}
                  onClose={() => setShowReactPicker(false)}
                  onSelect={handleReaction}
                />
              </div>
            )}
          </div>

          {showReply && (
            <div className="mt-2 rounded-2xl border border-border bg-card/30 p-3 space-y-2">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onPaste={handlePaste}
                placeholder="Write a reply..."
                className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                rows={2}
                maxLength={MAX_CHARS}
              />

              {imagePreview && (
                <div className="relative mb-2 overflow-hidden rounded-xl border border-border max-w-[200px]">
                  <img src={imagePreview} alt="Preview" className="max-h-40 w-full object-cover" />
                  <button
                    type="button"
                    onClick={clearImage}
                    className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                    aria-label="Remove image"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}

              {error && <p className="text-xs text-red-500">{error}</p>}

              <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/50">
                <div className="flex items-center gap-1">
                  <div className="relative">
                    <Button
                      variant="ghost" size="icon"
                      onClick={() => setShowEmoji(!showEmoji)}
                      className="h-8 w-8 text-twitter-blue"
                      aria-label="Add emoji"
                    >
                      <Smile className="h-4 w-4" />
                    </Button>
                    <EmojiPickerPopover
                      open={showEmoji}
                      onClose={() => setShowEmoji(false)}
                      onSelect={(emoji) => setContent((c) => c + emoji)}
                    />
                  </div>
                  <Button
                    variant="ghost" size="icon"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={!!imageFile}
                    className="h-8 w-8 text-twitter-blue"
                    aria-label="Add image"
                  >
                    <ImagePlus className="h-4 w-4" />
                  </Button>
                  <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setImage(file);
                    e.target.value = '';
                  }} />
                </div>

                <div className="flex items-center gap-2">
                  {nearLimit && (
                    <span className={`text-xs tabular-nums ${charsLeft < 0 ? 'text-red-500' : charsLeft < 50 ? 'text-yellow-500' : 'text-muted-foreground'}`}>
                      {charsLeft}
                    </span>
                  )}
                  <Button
                    size="sm"
                    onClick={handleReply}
                    disabled={loading || uploading || (!content.trim() && !imageFile) || charsLeft < 0}
                  >
                    {uploading ? 'Uploading...' : loading ? 'Sending...' : 'Reply'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {loadingChildren && childTotal > 0 && (
        <p className="ml-10 pb-2 text-xs text-muted-foreground">Loading replies...</p>
      )}
      {children.map((child) => (
        <ReplyItem key={child.id} reply={child} postId={postId} depth={depth + 1} />
      ))}
      {hasMoreChildren && (
        <button
          type="button"
          onClick={() => fetchMoreChildren()}
          disabled={loadingMoreChildren}
          className="mb-2 ml-10 flex items-center gap-1 text-sm font-medium text-twitter-blue hover:underline"
        >
          <ChevronDown className="h-4 w-4" />
          {loadingMoreChildren ? 'Loading...' : `Show more replies${remainingChildren > 0 ? ` (${remainingChildren} remaining)` : ''}`}
        </button>
      )}
    </div>
  );
}

export function ThreadView({ postId }: { postId: string }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const queryClient = useQueryClient();

  const [showEmoji, setShowEmoji] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const setImage = useCallback((file: File) => {
    if (file.size > 5 * 1024 * 1024) { setError('Image must be under 5MB'); return; }
    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
      setError('Only JPEG, PNG, GIF and WebP are allowed');
      return;
    }
    setImagePreview((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(file); });
    setImageFile(file);
    setError('');
  }, []);

  const clearImage = () => {
    setImageFile(null);
    setImagePreview((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
  };

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = Array.from(e.clipboardData.items);
    const imageItem = items.find((item) => item.type.startsWith('image/'));
    if (!imageItem) return;
    e.preventDefault();
    const file = imageItem.getAsFile();
    if (file) setImage(file);
  }, [setImage]);

  const { data: postData } = useQuery({
    queryKey: ['post', postId],
    queryFn: () => api.get<{ post: Post }>(`/posts/${postId}`),
  });

  const { data: threadData, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading: threadLoading } =
    useInfiniteQuery({
      queryKey: ['thread', postId],
      queryFn: ({ pageParam }) => api.get<ThreadRepliesResponse>(buildThreadUrl(postId, undefined, pageParam as string | undefined)),
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : undefined),
    });

  const topLevelReplies = threadData?.pages.flatMap((p) => p.replies) ?? [];
  const topLevelTotal = threadData?.pages[0]?.total ?? 0;
  const totalReplies = postData?.post.replyCount ?? topLevelTotal;
  const remainingTopLevel = Math.max(0, topLevelTotal - topLevelReplies.length);

  const handleReply = async () => {
    if (!accessToken || (!content.trim() && !imageFile)) return;
    setLoading(true);
    setError('');
    try {
      let imageUrl: string | undefined;
      if (imageFile) {
        setUploading(true);
        const compressed = await compressImage(imageFile);
        imageUrl = await uploadFile(compressed, accessToken);
        setUploading(false);
      }

      const res = await api.post<{ reply: ThreadReply }>(`/threads/${postId}`, { content: content.trim(), imageUrl }, accessToken);
      queryClient.setQueryData(
        ['thread', postId],
        (old: { pages: ThreadRepliesResponse[]; pageParams: unknown[] } | undefined) => {
          if (!old?.pages.length) return { pages: [{ replies: [res.reply], nextCursor: null, hasMore: false, total: 1 }], pageParams: [undefined] };
          const pages = [...old.pages];
          const first = pages[0];
          if (first.replies.some((r) => r.id === res.reply.id)) return old;
          pages[0] = { ...first, replies: [...first.replies, res.reply], total: first.total + 1 };
          return { ...old, pages };
        }
      );
      queryClient.setQueryData(['post', postId], (old: { post: Post } | undefined) =>
        old ? { post: { ...old.post, replyCount: old.post.replyCount + 1 } } : old
      );
      setContent('');
      clearImage();
      setShowEmoji(false);
    } catch (err) {
      setError((err as Error).message);
      setUploading(false);
    } finally {
      setLoading(false);
    }
  };

  const charsLeft = MAX_CHARS - content.length;
  const nearLimit = charsLeft <= 200;

  return (
    <div>
      <div
        className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/80 px-3 py-3 backdrop-blur sm:gap-4 sm:px-4"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0px))' }}
      >
        <Link href="/" className="shrink-0 rounded-full p-1 hover:bg-border/50">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-lg font-bold sm:text-xl">Thread</h1>
          {totalReplies > 0 && (
            <p className="text-xs text-muted-foreground">
              {totalReplies} {totalReplies === 1 ? 'reply' : 'replies'}
            </p>
          )}
        </div>
      </div>

      {postData?.post && <PostCard post={postData.post} variant="detail" />}

      <div className="border-b border-border p-3 sm:p-4">
        {accessToken ? (
          <div className="space-y-2">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onPaste={handlePaste}
              placeholder="Reply to thread..."
              className="w-full resize-none bg-transparent text-base outline-none placeholder:text-muted-foreground"
              rows={3}
              maxLength={MAX_CHARS}
            />

            {imagePreview && (
              <div className="relative mb-3 overflow-hidden rounded-2xl border border-border">
                <img src={imagePreview} alt="Preview" className="max-h-72 w-full object-cover" />
                <button
                  type="button"
                  onClick={clearImage}
                  className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                  aria-label="Remove image"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex items-center justify-between gap-3 pt-2 border-t border-border/50">
              <div className="flex items-center gap-1">
                <div className="relative">
                  <Button
                    variant="ghost" size="icon"
                    onClick={() => setShowEmoji(!showEmoji)}
                    className="h-9 w-9 text-twitter-blue sm:h-10 sm:w-10"
                    aria-label="Add emoji"
                  >
                    <Smile className="h-5 w-5" />
                  </Button>
                  <EmojiPickerPopover
                    open={showEmoji}
                    onClose={() => setShowEmoji(false)}
                    onSelect={(emoji) => setContent((c) => c + emoji)}
                  />
                </div>
                <Button
                  variant="ghost" size="icon"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!!imageFile}
                  className="h-9 w-9 text-twitter-blue sm:h-10 sm:w-10"
                  aria-label="Add image"
                >
                  <ImagePlus className="h-5 w-5" />
                </Button>
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setImage(file);
                  e.target.value = '';
                }} />
              </div>

              <div className="flex items-center gap-3">
                {nearLimit && (
                  <span className={`text-xs tabular-nums ${charsLeft < 0 ? 'text-red-500' : charsLeft < 50 ? 'text-yellow-500' : 'text-muted-foreground'}`}>
                    {charsLeft}
                  </span>
                )}
                <Button
                  onClick={handleReply}
                  disabled={loading || uploading || (!content.trim() && !imageFile) || charsLeft < 0}
                  className="w-full max-w-[140px] sm:w-auto"
                >
                  {uploading ? 'Uploading...' : loading ? 'Sending...' : 'Reply'}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-center text-muted-foreground">
            <Link href="/login" className="text-twitter-blue hover:underline">Sign in</Link> to reply
          </p>
        )}
      </div>

      <div className="px-2 sm:px-4">
        {threadLoading && (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading replies...</p>
        )}
        {!threadLoading && topLevelReplies.map((reply) => (
          <ReplyItem key={reply.id} reply={reply} postId={postId} />
        ))}
        {!threadLoading && hasNextPage && (
          <div className="border-t border-border py-4 text-center">
            <Button
              variant="ghost"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="text-twitter-blue hover:bg-twitter-blue/10"
            >
              <ChevronDown className="mr-1 h-4 w-4" />
              {isFetchingNextPage ? 'Loading more replies...' : `Load more${remainingTopLevel > 0 ? ` (${remainingTopLevel} remaining)` : ''}`}
            </Button>
          </div>
        )}
        {!threadLoading && !topLevelReplies.length && (
          <p className="py-8 text-center text-muted-foreground">No replies yet — start the conversation!</p>
        )}
      </div>
    </div>
  );
}
