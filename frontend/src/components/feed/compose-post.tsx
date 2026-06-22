'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ImagePlus, Smile, Sticker } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmojiPickerPopover } from '@/components/ui/emoji-picker-popover';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { useFeedStore } from '@/stores/feed';
import { cn } from '@/lib/utils';
import { StickerPicker } from './sticker-picker';
import type { Post } from '@/types';

export function ComposePost() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const prependPost = useFeedStore((s) => s.prependPost);
  const [caption, setCaption] = useState('');
  const [media, setMedia] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [stickerUrl, setStickerUrl] = useState<string | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showStickers, setShowStickers] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!accessToken) {
    return (
      <div className="border-b border-border p-4 text-center text-muted-foreground">
        <a href="/login" className="text-twitter-blue hover:underline">Sign in</a> to post
      </div>
    );
  }

  const canPost = Boolean(caption.trim() || media || stickerUrl);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMedia(file);
    setStickerUrl(null);
    setPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    if (!canPost) {
      setError('Write a caption or add an image, GIF, or sticker');
      return;
    }
    setLoading(true);
    setError('');
    try {
      let res: { post: Post };

      if (media || stickerUrl) {
        const formData = new FormData();
        if (media) formData.append('media', media);
        if (stickerUrl) formData.append('stickerUrl', stickerUrl);
        if (caption.trim()) formData.append('caption', caption.trim());
        res = await api.post<{ post: Post }>('/posts', formData, accessToken);
      } else {
        res = await api.post<{ post: Post }>('/posts', { caption: caption.trim() }, accessToken);
      }

      prependPost(res.post);
      setCaption('');
      setMedia(null);
      setPreview(null);
      setStickerUrl(null);
      setShowEmoji(false);
      setShowStickers(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border-b border-border p-3 sm:p-4">
      <textarea
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        placeholder="What's pulsing? #hashtags welcome"
        className="w-full resize-none bg-transparent text-base outline-none placeholder:text-muted-foreground sm:text-lg"
        rows={3}
        maxLength={500}
      />

      <AnimatePresence>
        {(preview || stickerUrl) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="relative my-3 overflow-hidden rounded-2xl border border-border"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview ?? stickerUrl!}
              alt="Preview"
              className="max-h-80 w-full object-contain"
            />
            <button
              type="button"
              onClick={() => { setMedia(null); setPreview(null); setStickerUrl(null); }}
              className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-1 text-xs text-white"
            >
              Remove
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {error && <p className="mb-2 text-sm text-red-500">{error}</p>}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-0.5">
          <label
            className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-twitter-blue transition-colors hover:bg-twitter-blue/10 sm:h-10 sm:w-10"
            title="Add image or GIF"
          >
            <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
            <ImagePlus className="h-5 w-5" />
          </label>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowStickers(!showStickers)}
            className={cn('h-9 w-9 text-twitter-blue sm:h-10 sm:w-10', showStickers && 'bg-twitter-blue/10')}
            title="Add sticker"
            aria-label="Add sticker"
          >
            <Sticker className="h-5 w-5" />
          </Button>
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowEmoji(!showEmoji)}
              className="h-9 w-9 text-twitter-blue sm:h-10 sm:w-10"
              aria-label="Add emoji to caption"
            >
              <Smile className="h-5 w-5" />
            </Button>
            <EmojiPickerPopover
              open={showEmoji}
              onClose={() => setShowEmoji(false)}
              onSelect={(emoji) => setCaption((c) => c + emoji)}
            />
          </div>
        </div>
        <Button onClick={handleSubmit} disabled={loading || !canPost} className="w-full sm:w-auto">
          {loading ? 'Posting...' : 'Pulse'}
        </Button>
      </div>

      {showStickers && (
        <StickerPicker
          onSelect={(url) => {
            setStickerUrl(url);
            setMedia(null);
            setPreview(null);
            setShowStickers(false);
          }}
        />
      )}
    </div>
  );
}
