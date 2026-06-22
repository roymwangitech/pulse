'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/app-layout';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar } from '@/components/ui/avatar';
import { useAuthStore } from '@/stores/auth';
import { useThemeStore } from '@/stores/theme';
import { api } from '@/lib/api';

export default function SettingsPage() {
  const router = useRouter();
  const { user, accessToken, setAuth, logout } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  if (!user || !accessToken) {
    return (
      <AppLayout>
        <div className="p-8 text-center">
          <p className="text-muted-foreground">Please <a href="/login" className="text-twitter-blue">sign in</a></p>
        </div>
      </AppLayout>
    );
  }

  const handleUpdateProfile = async () => {
    setLoading(true);
    try {
      const res = await api.patch<{ user: typeof user }>('/users/profile', { displayName }, accessToken);
      setAuth(res.user, accessToken);
      setMessage('Profile updated');
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateAvatar = async () => {
    setLoading(true);
    try {
      const res = await api.post<{ avatarUrl: string }>('/users/avatar/regenerate', {}, accessToken);
      setAuth({ ...user, avatarUrl: res.avatarUrl }, accessToken);
      setMessage('Avatar regenerated');
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout', {}, accessToken);
    } finally {
      logout();
      router.push('/login');
    }
  };

  return (
    <AppLayout>
      <PageHeader title="Settings" />
      <div className="space-y-6 p-3 sm:p-4">
        <section>
          <h2 className="mb-3 text-lg font-semibold">Profile</h2>
          <div className="flex items-center gap-4">
            <Avatar src={user.avatarUrl} alt={user.username} size="lg" />
            <Button variant="secondary" onClick={handleRegenerateAvatar} disabled={loading}>
              Regenerate Avatar
            </Button>
          </div>
          <div className="mt-4 space-y-3">
            <Input
              placeholder="Display name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
            <Button onClick={handleUpdateProfile} disabled={loading}>Save</Button>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">Appearance</h2>
          <div className="flex gap-2">
            <Button variant={theme === 'dark' ? 'default' : 'secondary'} onClick={() => setTheme('dark')}>
              Dark
            </Button>
            <Button variant={theme === 'light' ? 'default' : 'secondary'} onClick={() => setTheme('light')}>
              Light
            </Button>
          </div>
        </section>

        <section>
          <Button variant="destructive" onClick={handleLogout}>Log out</Button>
        </section>

        {message && <p className="text-sm text-muted-foreground">{message}</p>}
      </div>
    </AppLayout>
  );
}
