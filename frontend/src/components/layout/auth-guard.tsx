'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const hydrated = useAuthStore((s) => s._hydrated);
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    if (hydrated && !accessToken) {
      router.replace('/login');
    }
  }, [hydrated, accessToken, router]);

  // Wait for localStorage to rehydrate before making any auth decision
  if (!hydrated) return null;

  if (!accessToken) return null;

  return <>{children}</>;
}
