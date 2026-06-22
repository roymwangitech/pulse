'use client';

import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/app-layout';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AdminPage() {
  const router = useRouter();
  const { user, accessToken } = useAuthStore();

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
    queryFn: () => api.get<{ users: Array<{ id: string; username: string; displayName: string | null; avatarUrl: string; status: string; _count: { posts: number } }> }>('/admin/users', accessToken!),
    enabled: !!accessToken && user?.role === 'ADMIN',
  });

  const { data: posts, refetch: refetchPosts } = useQuery({
    queryKey: ['admin-posts'],
    queryFn: () => api.get<{ posts: Array<{ id: string; caption: string | null; user: { username: string }; _count: { replies: number; reactions: number } }> }>('/admin/posts', accessToken!),
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

  const handleDeletePost = async (postId: string) => {
    await api.delete(`/admin/posts/${postId}`, accessToken!);
    refetchPosts();
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
                    <p className="text-xs text-muted-foreground">{u._count.posts} posts · {u.status}</p>
                  </div>
                </div>
                {u.status === 'ACTIVE' ? (
                  <Button variant="destructive" size="sm" onClick={() => handleBan(u.id)}>Ban</Button>
                ) : (
                  <Button variant="secondary" size="sm" onClick={() => handleUnban(u.id)}>Unban</Button>
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
                <Button variant="destructive" size="sm" onClick={() => handleDeletePost(p.id)}>Delete</Button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
