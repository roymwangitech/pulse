'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/auth';
import type { User } from '@/types';

function AuthSync() {
  const { accessToken, setUser } = useAuthStore();

  useEffect(() => {
    if (!accessToken) return;
    // Sync the stored user with the DB on every app boot so role changes
    // (e.g. admin promotion) are picked up without requiring a re-login.
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.ok ? r.json() : null)
      .then((data: { user: User } | null) => { if (data?.user) setUser(data.user); })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthSync />
      {children}
    </QueryClientProvider>
  );
}
