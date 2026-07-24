'use client';

import { Analytics } from '@vercel/analytics/react';

export function VercelAnalytics() {
  return (
    <Analytics
      beforeSend={(event) => {
        // Exclude direct messages and admin routes from tracking to reduce edge requests and respect privacy
        if (
          event.url.includes('/messages') ||
          event.url.includes('/admin')
        ) {
          return null;
        }

        // Client-side sample rate: only send 50% of analytics events to Vercel
        const sampleRate = 0.5;
        const shouldSend = Math.random() < sampleRate;
        if (!shouldSend) {
          return null;
        }

        return event;
      }}
    />
  );
}
