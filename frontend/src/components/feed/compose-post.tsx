'use client';

import { useState } from 'react';
import { Smile } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmojiPickerPopover } from '@/components/ui/emoji-picker-popover';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { useFeedStore } from '@/stores/feed';
import type { Post } from '@/types';

export function ComposePost() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const prependPost = useFeedStore((s) => s.prependPost);
  const [caption, setCaption] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!accessToken) {
    return (
      <div className="border-b border-border p-4 text-center text-muted-foreground">
        <a href="/login" className="text-twitter-blue hover:underline">Sign in</a> to post
      </div>
    );
  }

  const canPost = Boolean(caption.trim());

  const handleSubmit = async () => {
    if (!canPost) {
      setError('Write a message to pulse');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await api.post<{ post: Post }>(
        '/posts',
        { caption: caption.trim() },
        accessToken
      );
      prependPost(res.post);
      setCaption('');
      setShowEmoji(false);
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

      {error && <p className="mb-2 text-sm text-red-500">{error}</p>}

      <div className="flex items-center justify-between gap-3">
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
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
        <Button onClick={handleSubmit} disabled={loading || !canPost} className="w-full max-w-[140px] sm:w-auto">
          {loading ? 'Posting...' : 'Pulse'}
        </Button>
      </div>
    </div>
  );
}
