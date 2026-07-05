'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Home, Compass, MessageSquare, Mail, User, MoreHorizontal, Settings, Shield, Sun, Moon, LogOut, LogIn } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth';
import { useThemeStore } from '@/stores/theme';
import { api } from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';

const mainNav = [
  { href: '/', label: 'Home', icon: Home, match: (p: string) => p === '/' },
  { href: '/explore', label: 'Explore', icon: Compass, match: (p: string) => p.startsWith('/explore') },
  { href: '/messages', label: 'Messages', icon: Mail, match: (p: string) => p.startsWith('/messages') },
  { href: '/threads', label: 'Threads', icon: MessageSquare, match: (p: string) => p.startsWith('/threads') },
  { href: '/profile', label: 'Profile', icon: User, match: (p: string) => p.startsWith('/profile') },
];

import { useUnreadDmCount } from '@/hooks/use-unread-dm-count';

export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const logout = useAuthStore((s) => s.logout);
  const { theme, toggleTheme } = useThemeStore();
  const [showMore, setShowMore] = useState(false);
  const unread = useUnreadDmCount();

  const handleLogout = async () => {
    try {
      if (accessToken) await api.post('/auth/logout', { refreshToken }, accessToken);
    } finally {
      logout();
      setShowMore(false);
      router.push('/login');
    }
  };

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-md md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        aria-label="Mobile navigation"
      >
        <div className="mx-auto flex h-14 max-w-lg items-stretch justify-around">
          {mainNav.map(({ href, label, icon: Icon, match }) => {
            const active = match(pathname);
            const isMessages = href === '/messages';
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors',
                  active ? 'text-twitter-blue' : 'text-muted-foreground'
                )}
              >
                <div className="relative">
                  <Icon className={cn('h-6 w-6', active && 'stroke-[2.5]')} />
                  {isMessages && unread > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-twitter-blue text-[9px] font-bold text-white">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </div>
                <span>{label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setShowMore(true)}
            className="flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-muted-foreground"
            aria-label="More options"
          >
            <MoreHorizontal className="h-6 w-6" />
            <span>More</span>
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {showMore && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-black/60 md:hidden"
              onClick={() => setShowMore(false)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="fixed bottom-0 left-0 right-0 z-[70] rounded-t-2xl border-t border-border bg-card p-4 md:hidden"
              style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
            >
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />
              <div className="space-y-1">
                <Link
                  href="/settings"
                  onClick={() => setShowMore(false)}
                  className="flex items-center gap-4 rounded-xl px-4 py-3 hover:bg-border/50"
                >
                  <Settings className="h-5 w-5" />
                  <span className="font-medium">Settings</span>
                </Link>
                {user?.role === 'ADMIN' && (
                  <Link
                    href="/admin"
                    onClick={() => setShowMore(false)}
                    className="flex items-center gap-4 rounded-xl px-4 py-3 hover:bg-border/50"
                  >
                    <Shield className="h-5 w-5" />
                    <span className="font-medium">Admin</span>
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => { toggleTheme(); setShowMore(false); }}
                  className="flex w-full items-center gap-4 rounded-xl px-4 py-3 hover:bg-border/50"
                >
                  {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                  <span className="font-medium">{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
                </button>
                {user ? (
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-4 rounded-xl px-4 py-3 text-red-500 hover:bg-border/50"
                  >
                    <LogOut className="h-5 w-5" />
                    <span className="font-medium">Log out</span>
                  </button>
                ) : (
                  <Link
                    href="/login"
                    onClick={() => setShowMore(false)}
                    className="flex items-center gap-4 rounded-xl px-4 py-3 hover:bg-border/50"
                  >
                    <LogIn className="h-5 w-5" />
                    <span className="font-medium">Sign in</span>
                  </Link>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
