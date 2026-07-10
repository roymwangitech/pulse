'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/app-layout';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { Pin } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
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

export default function AdminPage() {
  const router = useRouter();
  const { user, accessToken } = useAuthStore();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (user && user.role !== 'ADMIN') router.push('/');
  }, [user, router]);

  const { data: analytics } = useQuery({
    queryKey: ['admin-analytics'],
    queryFn: () => api.get<{ analytics: Record<string, number> }>('/admin/analytics', accessToken!),
    enabled: !!accessToken && user?.role === 'ADMIN',
  });

  const { data: users, refetch: refetchUsers } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api.get<{ users: AdminUser[] }>('/admin/users', accessToken!),
    enabled: !!accessToken && user?.role === 'ADMIN',
  });

  const { data: posts, refetch: refetchPosts } = useQuery({
    queryKey: ['admin-posts'],
    queryFn: () => api.get<{ posts: AdminPost[] }>('/admin/posts', accessToken!),
    enabled: !!accessToken && user?.role === 'ADMIN',
  });

  if (!user || user.role !== 'ADMIN') {
    return (
      <AppLayout>
        <div className="p-8 text-center text-muted-foreground">Admin access required</div>
      </AppLayout>
    );
  }

  const handleBan = async (userId: string) => {
    await api.post(`/admin/users/${userId}/ban`, {}, accessToken!);
    refetchUsers();
  };

  const handleUnban = async (userId: string) => {
    await api.post(`/admin/users/${userId}/unban`, {}, accessToken!);
    refetchUsers();
  };

  const handleBlockPosting = async (userId: string) => {
    await api.post(`/admin/users/${userId}/block-posting`, {}, accessToken!);
    refetchUsers();
  };

  const handleUnblockPosting = async (userId: string) => {
    await api.post(`/admin/users/${userId}/unblock-posting`, {}, accessToken!);
    refetchUsers();
  };

  const handleDeletePost = async (postId: string) => {
    await api.delete(`/admin/posts/${postId}`, accessToken!);
    // Update local cache to avoid a full refetch
    queryClient.setQueryData(['admin-posts'], (old: { posts: AdminPost[] } | undefined) =>
      old ? { ...old, posts: old.posts.filter((p) => p.id !== postId) } : old
    );
    queryClient.invalidateQueries({ queryKey: ['feed'] });
  };

  const handlePinPost = async (postId: string) => {
    const res = await api.post<{ action: string; post: Post }>(`/admin/posts/${postId}/pin`, {}, accessToken!);
    queryClient.setQueryData(['admin-posts'], (old: { posts: AdminPost[] } | undefined) => {
      if (!old) return old;
      const postUserId = old.posts.find((p) => p.id === postId)?.user.username;
      return {
        ...old,
        posts: old.posts.map((p) => {
          if (p.user.username === postUserId) return { ...p, pinned: p.id === postId && res.action === 'pinned' };
          return p;
        }),
      };
    });
    queryClient.invalidateQueries({ queryKey: ['feed'] });
  };

  return (
    <AppLayout>
      <PageHeader title="Admin Dashboard" />

      <div className="space-y-6 p-3 sm:p-4">
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

        <section>
          <h2 className="mb-3 text-lg font-bold">Users</h2>
          <div className="space-y-2">
            {users?.users.map((u) => (
              <div key={u.id} className="flex flex-col gap-3 rounded-xl border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <Avatar src={u.avatarUrl} alt={u.username} size="sm" />
                  <div>
                    <p className="font-semibold">@{u.username}</p>
                    <p className="text-xs text-muted-foreground">
                      {u._count.posts} posts · {u.role} · {u.status}
                      {u.postingBlocked && ' · posting blocked'}
                    </p>
                  </div>
                </div>
                {/* Only show controls for non-admin users */}
                {u.role !== 'ADMIN' && (
                  <div className="flex flex-wrap gap-2">
                    {u.postingBlocked ? (
                      <Button variant="secondary" size="sm" onClick={() => handleUnblockPosting(u.id)}>Allow Posts</Button>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => handleBlockPosting(u.id)}>Block Posts</Button>
                    )}
                    {u.status === 'ACTIVE' ? (
                      <Button variant="destructive" size="sm" onClick={() => handleBan(u.id)}>Ban</Button>
                    ) : (
                      <Button variant="secondary" size="sm" onClick={() => handleUnban(u.id)}>Unban</Button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-bold">Posts</h2>
          <div className="space-y-2">
            {posts?.posts.map((p) => (
              <div key={p.id} className="flex flex-col gap-3 rounded-xl border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm">@{p.user.username}</p>
                  <p className="truncate text-sm text-muted-foreground">{p.caption ?? '(no caption)'}</p>
                  <p className="text-xs text-muted-foreground">{p._count.replies} replies · {p._count.reactions} reactions</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className={p.pinned ? 'text-twitter-blue' : 'text-muted-foreground'}
                    onClick={() => handlePinPost(p.id)}
                    aria-label={p.pinned ? 'Unpin post' : 'Pin post'}
                  >
                    <Pin className={`mr-1 h-3.5 w-3.5 ${p.pinned ? 'fill-current' : ''}`} />
                    {p.pinned ? 'Unpin' : 'Pin'}
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDeletePost(p.id)}>Delete</Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
