'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { MessageCircle, Trash2, Smile, Pencil, Check, X, Pin } from 'lucide-react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { EmojiPickerPopover } from '@/components/ui/emoji-picker-popover';
import { ImageViewer } from '@/components/ui/image-viewer';
import { formatRelativeTime, getProxiedUrl } from '@/lib/utils';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { useFeedStore } from '@/stores/feed';
import type { Post } from '@/types';

// Splits caption into hashtags, URLs, and plain text — each rendered appropriately
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

interface PostCardProps {
  post: Post;
  variant?: 'feed' | 'detail';
}

export function PostCard({ post, variant = 'feed' }: PostCardProps) {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const updatePost = useFeedStore((s) => s.updatePost);
  const removePost = useFeedStore((s) => s.removePost);
  const [showEmoji, setShowEmoji] = useState(false);
  const [reacting, setReacting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editCaption, setEditCaption] = useState(post.caption);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [viewerOpen, setViewerOpen] = useState(false);

  const queryClient = useQueryClient();
  const [pinning, setPinning] = useState(false);

  const handlePin = async () => {
    if (!accessToken) return;
    setPinning(true);
    try {
      const res = await api.post<{ action: string; post: Post }>(`/posts/${post.id}/pin`, {}, accessToken);
      if (res.action === 'pinned') {
        const updatedPosts = useFeedStore.getState().posts.map((p) => {
          if (p.user.id === post.user.id) {
            return { ...p, pinned: p.id === post.id };
          }
          return p;
        });
        useFeedStore.getState().setPosts(updatedPosts);
        // also update react-query caches that contain feed pages
        queryClient.getQueriesData({ queryKey: ['feed'] }).forEach(([key]) => {
          queryClient.setQueryData(key as QueryKey, (old: { pages?: { posts: Post[] }[] } | undefined) => {
            if (!old || !old.pages) return old;
            return {
              ...old,
              pages: old.pages.map((page) => ({
                ...page,
                posts: page.posts.map((p) => (p.user.id === post.user.id ? { ...p, pinned: p.id === post.id } : p)),
              })),
            } as unknown as typeof old;
          });
        });
      } else {
        updatePost(post.id, { pinned: false });
        queryClient.getQueriesData({ queryKey: ['feed'] }).forEach(([key]) => {
          queryClient.setQueryData(key as QueryKey, (old: { pages?: { posts: Post[] }[] } | undefined) => {
            if (!old || !old.pages) return old;
            return {
              ...old,
              pages: old.pages.map((page) => ({
                ...page,
                posts: page.posts.map((p) => (p.id === post.id ? { ...p, pinned: false } : p)),
              })),
            } as unknown as typeof old;
          });
        });
      }
      // update single-post cache if present
      queryClient.setQueryData(['post', post.id], (old: { post?: Post } | undefined) => (old ? { post: { ...old.post!, pinned: res.action === 'pinned' } } : old));
      queryClient.invalidateQueries({ queryKey: ['user-posts'] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    } catch (err) {
      console.error(err);
    } finally {
      setPinning(false);
    }
  };

  const isOwner = user?.id === post.user.id;
  const isAdmin = user?.role === 'ADMIN';
  const isDetail = variant === 'detail';

  const handleReaction = async (emoji: string) => {
    if (!accessToken) return;
    setReacting(true);
    setShowEmoji(false);
    try {
      const res = await api.post<{ action: string }>(`/reactions/posts/${post.id}`, { emoji }, accessToken);
      const reactions = [...post.reactions];
      const idx = reactions.findIndex((r) => r.emoji === emoji);
      if (res.action === 'added') {
        if (idx >= 0) {
          reactions[idx] = { ...reactions[idx], count: reactions[idx].count + 1, userIds: [...(reactions[idx].userIds ?? []), user!.id] };
        } else {
          reactions.push({ emoji, count: 1, userIds: [user!.id] });
        }
      } else if (idx >= 0) {
        reactions[idx] = { ...reactions[idx], count: reactions[idx].count - 1, userIds: (reactions[idx].userIds ?? []).filter((id) => id !== user!.id) };
        if (reactions[idx].count <= 0) reactions.splice(idx, 1);
      }
      updatePost(post.id, { reactions });
      // update react-query feed pages and single post cache so UI updates immediately
      queryClient.getQueriesData({ queryKey: ['feed'] }).forEach(([key]) => {
        queryClient.setQueryData(key as QueryKey, (old: { pages?: { posts: Post[] }[] } | undefined) => {
          if (!old || !old.pages) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              posts: page.posts.map((p) => (p.id === post.id ? { ...p, reactions } : p)),
            })),
          } as unknown as typeof old;
        });
      });
      queryClient.setQueryData(['post', post.id], (old: { post?: Post } | undefined) => (old ? { post: { ...old.post!, reactions } } : old));
    } finally {
      setReacting(false);
    }
  };

  const handleDelete = async () => {
    if (!accessToken) return;
    await api.delete(`/posts/${post.id}`, accessToken);
    removePost(post.id);
    queryClient.getQueriesData({ queryKey: ['feed'] }).forEach(([key]) => {
      queryClient.setQueryData(key as QueryKey, (old: { pages?: { posts: Post[] }[] } | undefined) => {
        if (!old || !old.pages) return old;
        return { ...old, pages: old.pages.map((page) => ({ ...page, posts: page.posts.filter((p) => p.id !== post.id) })) } as unknown as typeof old;
      });
    });
    queryClient.removeQueries({ queryKey: ['post', post.id] });
    queryClient.invalidateQueries({ queryKey: ['user-posts'] });
  };

  const handleAdminPin = async () => {
    if (!accessToken) return;
    setPinning(true);
    try {
      const res = await api.post<{ action: string; post: Post }>(`/admin/posts/${post.id}/pin`, {}, accessToken);
      const pinned = res.action === 'pinned';
      const updateFeedCache = (posts: Post[]) =>
        posts.map((p) => (p.user.id === post.user.id ? { ...p, pinned: pinned ? p.id === post.id : p.id === post.id ? false : p.pinned } : p));
      updatePost(post.id, { pinned });
      queryClient.getQueriesData({ queryKey: ['feed'] }).forEach(([key]) => {
        queryClient.setQueryData(key as QueryKey, (old: { pages?: { posts: Post[] }[] } | undefined) => {
          if (!old || !old.pages) return old;
          return { ...old, pages: old.pages.map((page) => ({ ...page, posts: updateFeedCache(page.posts) })) } as unknown as typeof old;
        });
      });
      queryClient.setQueryData(['post', post.id], (old: { post?: Post } | undefined) => (old ? { post: { ...old.post!, pinned } } : old));
    } catch (err) {
      console.error(err);
    } finally {
      setPinning(false);
    }
  };

  const handleEditSave = async () => {
    if (!accessToken || !editCaption.trim() || editCaption.trim() === post.caption) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setEditError('');
    try {
      const res = await api.patch<{ post: Post }>(`/posts/${post.id}`, { caption: editCaption.trim() }, accessToken);
      updatePost(post.id, { caption: res.post.caption, editedAt: res.post.editedAt, hashtags: res.post.hashtags });
      // update react-query caches
      queryClient.getQueriesData({ queryKey: ['feed'] }).forEach(([key]) => {
        queryClient.setQueryData(key as QueryKey, (old: { pages?: { posts: Post[] }[] } | undefined) => {
          if (!old || !old.pages) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              posts: page.posts.map((p) => (p.id === post.id ? { ...p, caption: res.post.caption, editedAt: res.post.editedAt, hashtags: res.post.hashtags } : p)),
            })),
          } as unknown as typeof old;
        });
      });
      queryClient.setQueryData(['post', post.id], (old: { post?: Post } | undefined) => (old ? { post: { ...old.post!, caption: res.post.caption, editedAt: res.post.editedAt, hashtags: res.post.hashtags } } : old));
      setEditing(false);
    } catch (err) {
      setEditError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleEditCancel = () => {
    setEditCaption(post.caption);
    setEditing(false);
    setEditError('');
  };

  const openThread = () => {
    if (!isDetail) router.push(`/post/${post.id}`);
  };

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`border-b border-border p-3 transition-colors sm:p-4 ${isDetail ? '' : 'cursor-pointer hover:bg-card/50'}`}
      onClick={isDetail ? undefined : openThread}
    >
      {post.pinned && (
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-1 ml-[34px] sm:ml-[44px]">
          <Pin className="h-3.5 w-3.5 fill-muted-foreground" />
          <span>Pinned Post</span>
        </div>
      )}
      <div className="flex gap-2 sm:gap-3">
        <Link href={`/profile/${post.user.username}`} className="shrink-0" onClick={(e) => e.stopPropagation()}>
          <Avatar src={post.user.avatarUrl} alt={post.user.username} size="sm" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5 sm:gap-2">
            <Link href={`/profile/${post.user.username}`} className="max-w-[40vw] truncate font-bold hover:underline sm:max-w-none" onClick={(e) => e.stopPropagation()}>
              {post.user.displayName ?? post.user.username}
            </Link>
            <span className="truncate text-sm text-muted-foreground">@{post.user.username}</span>
            <span className="hidden text-muted-foreground sm:inline">·</span>
            <time className="text-xs text-muted-foreground sm:text-sm">{formatRelativeTime(post.createdAt)}</time>
            {post.editedAt && (
              <span className="text-xs text-muted-foreground italic" title={`Edited ${formatRelativeTime(post.editedAt)}`}>
                · edited
              </span>
            )}
            {(isOwner || isAdmin) && !editing && (
              <div className="ml-auto flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                {/* Pin button: owner pins own posts; admin can pin any post */}
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-8 w-8 ${post.pinned ? 'text-twitter-blue' : 'text-muted-foreground hover:text-twitter-blue'}`}
                  onClick={isAdmin && !isOwner ? handleAdminPin : handlePin}
                  disabled={pinning}
                  aria-label={post.pinned ? 'Unpin post' : 'Pin post'}
                >
                  <Pin className={`h-3.5 w-3.5 ${post.pinned ? 'fill-current' : ''}`} />
                </Button>
                {isOwner && (
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditCaption(post.caption); setEditing(true); }} aria-label="Edit post">
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600" onClick={handleDelete} aria-label="Delete post">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {editing ? (
            <div className="mt-2 space-y-2" onClick={(e) => e.stopPropagation()}>
              <textarea
                value={editCaption}
                onChange={(e) => setEditCaption(e.target.value)}
                className="w-full resize-none rounded-lg border border-twitter-blue bg-card p-2 text-sm outline-none focus:ring-2 focus:ring-twitter-blue"
                rows={3}
                maxLength={500}
                autoFocus
              />
              {editError && <p className="text-xs text-red-500">{editError}</p>}
              <div className="flex gap-2">
                <Button size="sm" onClick={handleEditSave} disabled={saving || !editCaption.trim()} className="gap-1">
                  <Check className="h-3.5 w-3.5" />
                  {saving ? 'Saving...' : 'Save'}
                </Button>
                <Button size="sm" variant="ghost" onClick={handleEditCancel} disabled={saving} className="gap-1">
                  <X className="h-3.5 w-3.5" />
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            post.caption && post.caption.trim() && (
              <p className="mt-1 whitespace-pre-wrap break-words">
                {renderCaption(post.caption)}
              </p>
            )
          )}

          {/* Post image */}
          {post.imageUrl && !editing && (
            <div
              className="mt-2 overflow-hidden rounded-2xl border border-border"
              onClick={(e) => e.stopPropagation()}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getProxiedUrl(post.imageUrl)}
                alt=""
                loading="lazy"
                className="max-h-[500px] w-full cursor-zoom-in object-cover transition-opacity hover:opacity-95"
                onClick={() => setViewerOpen(true)}
              />
            </div>
          )}

          {viewerOpen && post.imageUrl && (
            <ImageViewer src={getProxiedUrl(post.imageUrl)} onClose={() => setViewerOpen(false)} />
          )}

          <div className="mt-3 flex items-center gap-2 sm:gap-4" onClick={(e) => e.stopPropagation()}>
            <div className="relative">
              <Button
                variant="ghost" size="sm"
                onClick={() => setShowEmoji(!showEmoji)}
                disabled={reacting || !accessToken}
                className="h-8 gap-1 px-2 text-xs sm:h-9 sm:px-3 sm:text-sm"
                aria-label="React with emoji"
              >
                <Smile className="h-4 w-4 text-twitter-blue" />
                React
              </Button>
              <EmojiPickerPopover open={showEmoji} onClose={() => setShowEmoji(false)} onSelect={handleReaction} />
            </div>
            <Link href={`/post/${post.id}`} className="flex items-center gap-1 text-muted-foreground hover:text-twitter-blue">
              <MessageCircle className="h-4 w-4" />
              <span className="text-sm">{post.replyCount}</span>
            </Link>
          </div>

          {post.reactions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
              {post.reactions.map((r) => (
                <button
                  key={r.emoji} type="button"
                  onClick={() => handleReaction(r.emoji)}
                  className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-sm transition-colors ${
                    r.userIds?.includes(user?.id ?? '') ? 'border-twitter-blue bg-twitter-blue/20' : 'border-border hover:bg-border/50'
                  }`}
                >
                  <span>{r.emoji}</span>
                  <span className="text-xs">{r.count}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.article>
  );
}
