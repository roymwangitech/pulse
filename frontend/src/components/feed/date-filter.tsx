'use client';

import { useFeedStore } from '@/stores/feed';
import type { DateFilter } from '@/types';

const filters: { value: DateFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'today', label: 'Today' },
  { value: '7days', label: '7 Days' },
  { value: '30days', label: '30 Days' },
  { value: 'year', label: 'This Year' },
  { value: 'custom', label: 'Custom' },
];

export function DateFilterBar() {
  const { dateFilter, setDateFilter, customStartDate, customEndDate, setCustomDates } = useFeedStore();

  return (
    <div className="border-b border-border p-2 sm:p-3">
      <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-none sm:gap-2">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => setDateFilter(f.value)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              dateFilter === f.value
                ? 'bg-twitter-blue text-white'
                : 'bg-card border border-border hover:bg-border/50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      {dateFilter === 'custom' && (
        <div className="mt-2 flex gap-2">
          <input
            type="date"
            value={customStartDate}
            onChange={(e) => setCustomDates(e.target.value, customEndDate)}
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm"
          />
          <input
            type="date"
            value={customEndDate}
            onChange={(e) => setCustomDates(customStartDate, e.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm"
          />
        </div>
      )}
    </div>
  );
}
