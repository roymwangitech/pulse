'use client';

import { useState, useRef, useCallback } from 'react';
import { Smile, ImagePlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmojiPickerPopover } from '@/components/ui/emoji-picker-popover';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { useFeedStore } from '@/stores/feed';
import type { Post } from '@/types';

const MAX_CHARS = 3000;

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

export function ComposePost() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const prependPost = useFeedStore((s) => s.prependPost);
  const [caption, setCaption] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
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

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = Array.from(e.clipboardData.items);
    const imageItem = items.find((item) => item.type.startsWith('image/'));
    if (!imageItem) return;
    e.preventDefault();
    const file = imageItem.getAsFile();
    if (file) setImage(file);
  }, [setImage]);

  if (!accessToken) {
    return (
      <div className="border-b border-border p-4 text-center text-muted-foreground">
        <a href="/login" className="text-twitter-blue hover:underline">Sign in</a> to post
      </div>
    );
  }

  const canPost = Boolean(caption.trim()) || Boolean(imageFile);
  const charsLeft = MAX_CHARS - caption.length;
  const nearLimit = charsLeft <= 200;

  const clearImage = () => {
    setImageFile(null);
    setImagePreview((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setImage(file);
    e.target.value = '';
  };

  const handleSubmit = async () => {
    if (!canPost) { setError('Add a message or image'); return; }
    setLoading(true);
    setError('');
    try {
      let imageUrl: string | undefined;
      if (imageFile) {
        setUploading(true);
        imageUrl = await uploadFile(imageFile, accessToken);
        setUploading(false);
      }

      const res = await api.post<{ post: Post }>(
        '/posts',
        { caption: caption.trim() || ' ', imageUrl },
        accessToken
      );
      prependPost(res.post);
      setCaption('');
      clearImage();
      setShowEmoji(false);
    } catch (err) {
      setError((err as Error).message);
      setUploading(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border-b border-border p-3 sm:p-4">
      <textarea
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        onPaste={handlePaste}
        placeholder="What's pulsing? #hashtags and https://links welcome"
        className="w-full resize-none bg-transparent text-base outline-none placeholder:text-muted-foreground sm:text-lg"
        rows={3}
        maxLength={MAX_CHARS}
      />

      {/* Image preview */}
      {imagePreview && (
        <div className="relative mb-3 overflow-hidden rounded-2xl border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
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

      {error && <p className="mb-2 text-sm text-red-500">{error}</p>}

      <div className="flex items-center justify-between gap-3">
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
              onSelect={(emoji) => setCaption((c) => c + emoji)}
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
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={handleImageSelect} />
        </div>

        <div className="flex items-center gap-3">
          {nearLimit && (
            <span className={`text-xs tabular-nums ${charsLeft < 0 ? 'text-red-500' : charsLeft < 50 ? 'text-yellow-500' : 'text-muted-foreground'}`}>
              {charsLeft}
            </span>
          )}
          <Button
            onClick={handleSubmit}
            disabled={loading || !canPost || charsLeft < 0}
            className="w-full max-w-[140px] sm:w-auto"
          >
            {uploading ? 'Uploading...' : loading ? 'Posting...' : 'Pulse'}
          </Button>
        </div>
      </div>
    </div>
  );
}
