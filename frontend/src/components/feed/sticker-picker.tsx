'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Sticker } from '@/types';
import { motion } from 'framer-motion';

const CATEGORIES = ['MEMES', 'REACTIONS', 'GAMING', 'ANIME', 'ANIMALS', 'RANDOM_FUN'];

export function StickerPicker({ onSelect }: { onSelect: (url: string) => void }) {
  const [category, setCategory] = useState('MEMES');

  const { data } = useQuery({
    queryKey: ['stickers', category],
    queryFn: () => api.get<{ stickers: Sticker[] }>(`/stickers?category=${category}`),
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-3 rounded-2xl border border-border bg-card p-3"
    >
      <div className="mb-3 flex flex-wrap gap-1">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              category === cat ? 'bg-twitter-blue text-white' : 'bg-border/50 hover:bg-border'
            }`}
          >
            {cat.replace('_', ' ')}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-5 sm:gap-2">
        {data?.stickers.map((sticker) => (
          <button
            key={sticker.id}
            onClick={() => onSelect(sticker.url)}
            className="rounded-lg p-2 hover:bg-border/50 transition-colors"
            title={sticker.name}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={sticker.url} alt={sticker.name} className="mx-auto h-10 w-10 object-contain sm:h-12 sm:w-12" />
          </button>
        ))}
      </div>
    </motion.div>
  );
}
