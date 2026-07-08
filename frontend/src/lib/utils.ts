import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRelativeTime(date: string | Date): string {
  const now = new Date();
  const then = new Date(date);
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;

  return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function extractHashtags(text: string): string[] {
  const matches = text.match(/#[\w]+/g);
  return matches ? [...new Set(matches)] : [];
}

export function getProxiedUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (url.includes('.public.blob.vercel-storage.com')) {
    return `/api/blob?url=${encodeURIComponent(url)}`;
  }
  return url;
}

