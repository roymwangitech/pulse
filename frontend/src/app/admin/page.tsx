'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/app-layout';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { Pin, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import type { Post } from '@/types';

type AdminUser = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string;
  role: string;
  status: string;
  postingBlocked: boolean;
  _count: { posts: number };
};

type AdminPost = {
  id: string;
  caption: string | null;
  pinned: boolean;
  user: { username: string };
  _count: { replies: number; reactions: number };
};

type ConfirmDialog = {
  title: string;
  message: string;
  confirmLabel: string;
  variant: 'destructive' | 'default';
  onConfirm: () => Promise<void>;
} | null;

function ConfirmationDialog({ dialog, onClose }: { dialog: NonNullable<ConfirmDialog>; onClose: () => void }) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await dialog.onConfirm();
    } finally {
      setLoading(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl border border-border bg-background p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-1 text-base font-bold">{dialog.title}</h3>
        <p className="mb-5 text-sm text-muted-foreground">{dialog.message}</p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button
            variant={dialog.variant}
            size="sm"
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? 'Please wait…' : dialog.confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const { user, accessToken } = useAuthStore();
  const queryClient = useQueryClient();

  // Users section state
  const [userPage, setUserPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  // Posts section state
  const [postPage, setPostPage] = useState(1);

  // Confirmation dialog
  const [confirm, setConfirm] = useState<ConfirmDialog>(null);

  useEffect(() => {
    if (user && user.role !== 'ADMIN') router.push('/');
  }, [user, router]);

  // Reset to page 1 when search changes
  useEffect(() => { setUserPage(1); }, [activeSearch]);

  const { data: analytics } = useQuery({
    queryKey: ['admin-analytics'],
    queryFn: () => api.get<{ analytics: Record<string, number> }>('/admin/analytics', accessToken!),
    enabled: !!accessToken && user?.role === 'ADMIN',
  });

  const { data: usersData, refetch: refetchUsers } = useQuery({
    queryKey: ['admin-users', userPage, activeSearch],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(userPage) });
      if (activeSearch) params.set('q', activeSearch);
      return api.get<{ users: AdminUser[]; total: number; page: number; totalPages: number }>(
        `/admin/users?${params}`, accessToken!
      );
    },
    enabled: !!accessToken && user?.role === 'ADMIN',
  });

  const { data: postsData } = useQuery({
    queryKey: ['admin-posts', postPage],
    queryFn: () =>
      api.get<{ posts: AdminPost[]; total: number; totalPages: number }>(
        `/admin/posts?page=${postPage}`, accessToken!
      ),
    enabled: !!accessToken && user?.role === 'ADMIN',
  });

  if (!user || user.role !== 'ADMIN') {
    return (
      <AppLayout>
        <div className="p-8 text-center text-muted-foreground">Admin access required</div>
      </AppLayout>
    );
  }

  const ask = (dialog: NonNullable<ConfirmDialog>) => setConfirm(dialog);

  const handleBan = (u: AdminUser) => ask({
    title: `Ban @${u.username}?`,
    message: 'This will prevent them from logging in.',
    confirmLabel: 'Ban user',
    variant: 'destructive',
    onConfirm: async () => {
      await api.post(`/admin/users/${u.id}/ban`, {}, accessToken!);
      refetchUsers();
    },
  });

  const handleUnban = (u: AdminUser) => ask({
    title: `Unban @${u.username}?`,
    message: 'They will be able to log in again.',
    confirmLabel: 'Unban',
    variant: 'default',
    onConfirm: async () => {
      await api.post(`/admin/users/${u.id}/unban`, {}, accessToken!);
      refetchUsers();
    },
  });

  const handleBlockPosting = (u: AdminUser) => ask({
    title: `Block posts for @${u.username}?`,
    message: 'They will not be able to create new posts.',
    confirmLabel: 'Block posting',
    variant: 'destructive',
    onConfirm: async () => {
      await api.post(`/admin/users/${u.id}/block-posting`, {}, accessToken!);
      refetchUsers();
    },
  });

  const handleUnblockPosting = (u: AdminUser) => ask({
    title: `Allow posting for @${u.username}?`,
    message: 'They will be able to create posts again.',
    confirmLabel: 'Allow posting',
    variant: 'default',
    onConfirm: async () => {
      await api.post(`/admin/users/${u.id}/unblock-posting`, {}, accessToken!);
      refetchUsers();
    },
  });

  const handleDeletePost = (p: AdminPost) => ask({
    title: 'Delete this post?',
    message: `Post by @${p.user.username} will be permanently removed.`,
    confirmLabel: 'Delete post',
    variant: 'destructive',
    onConfirm: async () => {
      await api.delete(`/admin/posts/${p.id}`, accessToken!);
      queryClient.setQueryData(['admin-posts', postPage], (old: { posts: AdminPost[] } | undefined) =>
        old ? { ...old, posts: old.posts.filter((x) => x.id !== p.id) } : old
      );
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });

  const handlePinPost = async (p: AdminPost) => {
    const res = await api.post<{ action: string; post: Post }>(`/admin/posts/${p.id}/pin`, {}, accessToken!);
    queryClient.setQueryData(['admin-posts', postPage], (old: { posts: AdminPost[] } | undefined) => {
      if (!old) return old;
      return {
        ...old,
        posts: old.posts.map((x) => {
          if (x.user.username === p.user.username) return { ...x, pinned: x.id === p.id && res.action === 'pinned' };
          return x;
        }),
      };
    });
    queryClient.invalidateQueries({ queryKey: ['feed'] });
  };

  const handleSearch = () => setActiveSearch(searchInput.trim());

  return (
    <AppLayout>
      <PageHeader title="Admin Dashboard" />

      {confirm && <ConfirmationDialog dialog={confirm} onClose={() => setConfirm(null)} />}

      <div className="space-y-6 p-3 sm:p-4">
        {/* Analytics */}
        {analytics && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
            {Object.entries(analytics.analytics).map(([key, value]) => (
              <Card key={key} className="p-4 text-center">
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-xs text-muted-foreground capitalize">{key.replace(/([A-Z])/g, ' $1')}</p>
              </Card>
            ))}
          </div>
        )}

        {/* Users section */}
        <section>
          <h2 className="mb-3 text-lg font-bold">Users</h2>

          {/* Search bar */}
          <div className="mb-3 flex gap-2">
            <div className="flex flex-1 items-center gap-2 rounded-full border border-border bg-card px-3 py-2">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                ref={searchRef}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search by username or name…"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => { setSearchInput(''); setActiveSearch(''); }}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  ✕
                </button>
              )}
            </div>
            <Button size="sm" onClick={handleSearch} className="rounded-full px-4">
              Search
            </Button>
          </div>

          {/* User list */}
          <div className="space-y-2">
            {usersData?.users.map((u) => (
              <div key={u.id} className="flex flex-col gap-3 rounded-xl border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <Avatar src={u.avatarUrl} alt={u.username} size="sm" />
                  <div>
                    <p className="font-semibold">@{u.username}</p>
                    <p className="text-xs text-muted-foreground">
                      {u._count.posts} posts · {u.role}
                      {u.status === 'BANNED' && ' · banned'}
                      {u.postingBlocked && ' · posting blocked'}
                    </p>
                  </div>
                </div>
                {u.role !== 'ADMIN' && (
                  <div className="flex flex-wrap gap-2">
                    {u.postingBlocked ? (
                      <Button variant="secondary" size="sm" onClick={() => handleUnblockPosting(u)}>Allow Posts</Button>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => handleBlockPosting(u)}>Block Posts</Button>
                    )}
                    {u.status === 'ACTIVE' ? (
                      <Button variant="destructive" size="sm" onClick={() => handleBan(u)}>Ban</Button>
                    ) : (
                      <Button variant="secondary" size="sm" onClick={() => handleUnban(u)}>Unban</Button>
                    )}
                  </div>
                )}
              </div>
            ))}

            {usersData?.users.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {activeSearch ? `No users matching "${activeSearch}"` : 'No users found'}
              </p>
            )}
          </div>

          {/* Users pagination */}
          {usersData && usersData.totalPages > 1 && (
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Page {usersData.page} of {usersData.totalPages} · {usersData.total} users
              </span>
              <div className="flex gap-1">
                <Button
                  variant="ghost" size="icon"
                  onClick={() => setUserPage((p) => Math.max(1, p - 1))}
                  disabled={userPage === 1}
                  className="h-8 w-8"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost" size="icon"
                  onClick={() => setUserPage((p) => Math.min(usersData.totalPages, p + 1))}
                  disabled={userPage === usersData.totalPages}
                  className="h-8 w-8"
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </section>

        {/* Posts section */}
        <section>
          <h2 className="mb-3 text-lg font-bold">Posts</h2>
          <div className="space-y-2">
            {postsData?.posts.map((p) => (
              <div key={p.id} className="flex flex-col gap-3 rounded-xl border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium">@{p.user.username}</p>
                  <p className="truncate text-sm text-muted-foreground">{p.caption ?? '(no caption)'}</p>
                  <p className="text-xs text-muted-foreground">{p._count.replies} replies · {p._count.reactions} reactions</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    variant="ghost" size="sm"
                    className={p.pinned ? 'text-twitter-blue' : 'text-muted-foreground'}
                    onClick={() => handlePinPost(p)}
                    aria-label={p.pinned ? 'Unpin post' : 'Pin post'}
                  >
                    <Pin className={`mr-1 h-3.5 w-3.5 ${p.pinned ? 'fill-current' : ''}`} />
                    {p.pinned ? 'Unpin' : 'Pin'}
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDeletePost(p)}>Delete</Button>
                </div>
              </div>
            ))}
          </div>

          {/* Posts pagination */}
          {postsData && postsData.totalPages > 1 && (
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Page {postsData.page} of {postsData.totalPages}
              </span>
              <div className="flex gap-1">
                <Button
                  variant="ghost" size="icon"
                  onClick={() => setPostPage((p) => Math.max(1, p - 1))}
                  disabled={postPage === 1}
                  className="h-8 w-8"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost" size="icon"
                  onClick={() => setPostPage((p) => Math.min(postsData.totalPages, p + 1))}
                  disabled={postPage === postsData.totalPages}
                  className="h-8 w-8"
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
