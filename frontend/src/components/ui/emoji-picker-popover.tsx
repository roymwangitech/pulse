'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

import { EmojiStyle } from 'emoji-picker-react';

const EmojiPicker = dynamic(() => import('emoji-picker-react'), { ssr: false });

interface EmojiPickerPopoverProps {
  open: boolean;
  onClose: () => void;
  onSelect: (emoji: string) => void;
}

const PICKER_HEIGHT = 400; // approximate height of the picker

export function EmojiPickerPopover({ open, onClose, onSelect }: EmojiPickerPopoverProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const [openUpward, setOpenUpward] = useState(false);

  // Decide direction based on available space when opening
  useEffect(() => {
    if (!open || !anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    setOpenUpward(spaceBelow < PICKER_HEIGHT && rect.top > PICKER_HEIGHT);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open, onClose]);

  const isLight = typeof document !== 'undefined' && document.documentElement.classList.contains('light');

  return (
    // Anchor div sits at 0×0 so we can measure position
    <div ref={anchorRef} className="absolute left-0 top-full">
      {open && (
        <>
          {/* Mobile: slide up from bottom */}
          <div className="fixed inset-0 z-40 bg-black/40 sm:hidden" onClick={onClose} aria-hidden="true" />
          <div
            ref={containerRef}
            className={`
              fixed inset-x-4 bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] z-50
              overflow-hidden rounded-2xl border border-border bg-card shadow-xl
              sm:fixed-none sm:inset-x-auto sm:absolute sm:left-0 sm:w-auto
              ${openUpward ? 'sm:bottom-full sm:mb-2 sm:top-auto' : 'sm:top-full sm:mt-2 sm:bottom-auto'}
            `}
          >
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <span className="text-sm font-medium">Pick an emoji</span>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose} aria-label="Close emoji picker">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <EmojiPicker
              onEmojiClick={(e) => { onSelect(e.emoji); onClose(); }}
              theme={isLight ? ('light' as never) : ('dark' as never)}
              width="100%"
              height={350}
              emojiStyle={EmojiStyle.NATIVE}
            />
          </div>
        </>
      )}
    </div>
  );
}
