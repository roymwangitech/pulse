'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Compass,
  MessageSquare,
  User,
  Settings,
  Sun,
  Moon,
  Zap,
  Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useThemeStore } from '@/stores/theme';
import { useAuthStore } from '@/stores/auth';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

const navItems = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/explore', label: 'Explore', icon: Compass },
  { href: '/threads', label: 'Threads', icon: MessageSquare },
  { href: '/profile', label: 'Profile', icon: User },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function LeftSidebar() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useThemeStore();
  const user = useAuthStore((s) => s.user);

  return (
    <aside className="sticky top-0 hidden h-screen w-full shrink-0 flex-col px-2 py-2 md:flex md:w-[88px] lg:w-[275px] lg:px-3">
      <Link
        href="/"
        className="mb-4 flex items-center justify-center gap-2 px-3 py-3 lg:justify-start"
      >
        <Zap className="h-7 w-7 text-twitter-blue lg:h-8 lg:w-8" fill="currentColor" />
        <span className="hidden text-xl font-bold lg:inline">PulseChat</span>
      </Link>

      <nav className="flex flex-1 flex-col gap-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              title={label}
              className={cn(
                'flex items-center justify-center gap-4 rounded-full px-3 py-3 text-lg transition-colors hover:bg-border/50 lg:justify-start lg:px-4',
                active && 'font-bold'
              )}
            >
              <Icon className={cn('h-6 w-6 shrink-0', active && 'text-twitter-blue')} />
              <span className="hidden lg:inline">{label}</span>
            </Link>
          );
        })}

        {user?.role === 'ADMIN' && (
          <Link
            href="/admin"
            title="Admin"
            className={cn(
              'flex items-center justify-center gap-4 rounded-full px-3 py-3 text-lg transition-colors hover:bg-border/50 lg:justify-start lg:px-4',
              pathname.startsWith('/admin') && 'font-bold'
            )}
          >
            <Shield className="h-6 w-6 shrink-0" />
            <span className="hidden lg:inline">Admin</span>
          </Link>
        )}
      </nav>

      <div className="space-y-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="mx-auto w-10 rounded-full lg:mx-0 lg:w-full"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>

        {user ? (
          <Link
            href={`/profile/${user.username}`}
            className="flex items-center justify-center gap-3 rounded-full p-2 hover:bg-border/50 lg:justify-start lg:p-3"
            title={user.displayName ?? user.username}
          >
            <Avatar src={user.avatarUrl} alt={user.username} size="sm" />
            <div className="hidden min-w-0 lg:block">
              <p className="truncate text-sm font-semibold">{user.displayName ?? user.username}</p>
              <p className="truncate text-xs text-muted-foreground">@{user.username}</p>
            </div>
          </Link>
        ) : (
          <Link href="/login" className="hidden lg:block">
            <Button className="w-full">Sign in</Button>
          </Link>
        )}
      </div>
    </aside>
  );
}
