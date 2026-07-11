'use client';

import { use, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Mail, Pencil, RefreshCw } from 'lucide-react';
import { AppLayout } from '@/components/layout/app-layout';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import type { User } from '@/types';

export default function UserProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params);
  const router = useRouter();
  const me = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const setUser = useAuthStore((s) => s.setUser);
  const queryClient = useQueryClient();

  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [editError, setEditError] = useState('');
  const [dmError, setDmError] = useState('');

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile', username],
    queryFn: () => api.get<{ user: User }>(`/users/${username}`),
  });

  const user = profile?.user;
  const isOwnProfile = me?.username === username;

  const updateDisplayName = useMutation({
    mutationFn: () =>
      api.patch<{ user: User }>('/users/profile', { displayName }, accessToken ?? undefined),
    onSuccess: (res) => {
      setUser(res.user);
      queryClient.setQueryData(['profile', username], { user: res.user });
      setEditing(false);
      setEditError('');
    },
    onError: (e) => setEditError((e as Error).message),
  });

  const regenerateAvatar = useMutation({
    mutationFn: () =>
      api.post<{ avatarUrl: string }>('/users/avatar/regenerate', undefined, accessToken ?? undefined),
    onSuccess: (res) => {
      if (user) {
        const updated = { ...user, avatarUrl: res.avatarUrl };
        setUser({ ...me!, avatarUrl: res.avatarUrl });
        queryClient.setQueryData(['profile', username], { user: updated });
      }
    },
  });

  const startDm = useMutation({
    mutationFn: () =>
      api.post<{ conversation: { id: string } }>('/dm', { username }, accessToken ?? undefined),
    onSuccess: (res) => router.push(`/messages/${res.conversation.id}`),
    onError: (e) => setDmError((e as Error).message),
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-8 text-center text-muted-foreground">Loading...</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 sm:p-6">
        {user && (
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
            {/* Avatar */}
            <div className="flex flex-col items-center gap-2">
              <Avatar src={user.avatarUrl} alt={user.username} size="lg" priority />
              {isOwnProfile && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => regenerateAvatar.mutate()}
                  disabled={regenerateAvatar.isPending}
                  className="gap-1.5 text-xs"
                >
                  <RefreshCw className="h-3 w-3" />
                  {regenerateAvatar.isPending ? 'Regenerating...' : 'New avatar'}
                </Button>
              )}
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1 text-center sm:text-left">
              {editing ? (
                <div className="flex flex-col gap-2">
                  <input
                    className="rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-twitter-blue"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    maxLength={50}
                    placeholder="Display name"
                    autoFocus
                  />
                  {editError && <p className="text-xs text-red-500">{editError}</p>}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => updateDisplayName.mutate()}
                      disabled={updateDisplayName.isPending || !displayName.trim()}
                    >
                      Save
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setEditing(false); setEditError(''); }}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 sm:justify-start">
                  <h1 className="truncate text-xl font-bold sm:text-2xl">
                    {user.displayName ?? user.username}
                  </h1>
                  {isOwnProfile && (
                    <button
                      onClick={() => { setDisplayName(user.displayName ?? ''); setEditing(true); }}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label="Edit display name"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )}

              <p className="mt-0.5 text-muted-foreground">@{user.username}</p>

              {!isOwnProfile && accessToken && (
                <div className="mt-4">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => startDm.mutate()}
                    disabled={startDm.isPending}
                    className="gap-1.5"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    Message
                  </Button>
                  {dmError && <p className="mt-1 text-xs text-red-500">{dmError}</p>}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
