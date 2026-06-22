'use client';

import { useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const EmojiPicker = dynamic(() => import('emoji-picker-react'), { ssr: false });

interface EmojiPickerPopoverProps {
  open: boolean;
  onClose: () => void;
  onSelect: (emoji: string) => void;
}

export function EmojiPickerPopover({ open, onClose, onSelect }: EmojiPickerPopoverProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open, onClose]);

  if (!open) return null;

  const isLight = typeof document !== 'undefined' && document.documentElement.classList.contains('light');

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 sm:hidden" onClick={onClose} aria-hidden="true" />
      <div
        ref={containerRef}
        className="fixed inset-x-4 bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] z-50 overflow-hidden rounded-2xl border border-border bg-card shadow-xl sm:absolute sm:inset-x-auto sm:bottom-full sm:left-0 sm:mb-2 sm:w-auto"
      >
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-sm font-medium">Pick an emoji</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose} aria-label="Close emoji picker">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <EmojiPicker
          onEmojiClick={(e) => {
            onSelect(e.emoji);
            onClose();
          }}
          theme={isLight ? ('light' as never) : ('dark' as never)}
          width="100%"
          height={350}
        />
      </div>
    </>
  );
}
