'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  Briefcase,
  ChartColumn,
  Inbox,
  LayoutDashboard,
  Moon,
  Search,
  Settings,
  Sun,
  UserRound,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { api, apiSend } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';

const NAV = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, key: 'd' },
  { href: '/jobs', label: 'Jobs', icon: Briefcase, key: 'j' },
  { href: '/applications', label: 'Applications', icon: Inbox, key: 'a' },
  { href: '/profile', label: 'Profile', icon: UserRound, key: 'p' },
  { href: '/search', label: 'Search', icon: Search, key: 's' },
  { href: '/analytics', label: 'Analytics', icon: ChartColumn, key: 'n' },
  { href: '/settings', label: 'Settings', icon: Settings, key: ',' },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [openNotes, setOpenNotes] = useState(false);
  const queryClient = useQueryClient();

  const notes = useQuery({
    queryKey: ['notifications'],
    queryFn: () =>
      api<Array<{ id: string; title: string; body: string; read: boolean; href?: string }>>(
        '/notifications',
      ),
  });
  const unread = notes.data?.filter((n) => !n.read).length ?? 0;
  const markRead = useMutation({
    mutationFn: () => apiSend('/notifications/read-all', 'POST'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (event.key === '/' && !event.metaKey) {
        event.preventDefault();
        router.push('/jobs');
      }
      if (event.key === 'g') {
        const handler = (next: KeyboardEvent) => {
          const item = NAV.find((nav) => nav.key === next.key);
          if (item) router.push(item.href);
          window.removeEventListener('keydown', handler);
        };
        window.addEventListener('keydown', handler, { once: true });
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-[220px] shrink-0 flex-col border-r border-border bg-sidebar p-3 md:flex">
        <div className="mb-4 px-2 pt-1">
          <div className="text-sm font-semibold tracking-tight">Job Hunter</div>
          <div className="text-[11px] text-muted-foreground">Local AI matching</div>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5">
          {NAV.map((item) => {
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground',
                  active && 'bg-muted text-foreground',
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <p className="px-2 text-[10px] leading-4 text-muted-foreground">
          Match Score is similarity, not a hiring probability. g then d/j/a for shortcuts.
        </p>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-12 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur">
          <div className="text-sm font-medium md:hidden">Job Hunter</div>
          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Notifications"
              onClick={() => setOpenNotes((v) => !v)}
            >
              <span className="relative">
                <Bell className="size-4" />
                {unread > 0 ? (
                  <span className="absolute -right-1 -top-1 h-1.5 w-1.5 rounded-full bg-accent" />
                ) : null}
              </span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Toggle theme"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              <Sun className="size-4 dark:hidden" />
              <Moon className="hidden size-4 dark:block" />
            </Button>
          </div>
        </header>
        {openNotes ? (
          <div className="absolute right-4 top-12 z-30 w-80 rounded-md border border-border bg-card p-2 shadow-sm">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-xs font-medium">Notifications</span>
              <button className="text-xs text-accent" onClick={() => markRead.mutate()}>
                Mark all read
              </button>
            </div>
            <div className="max-h-80 space-y-1 overflow-auto">
              {notes.data?.length ? (
                notes.data.map((note) => (
                  <Link
                    key={note.id}
                    href={note.href ?? '/'}
                    className="block rounded-md px-2 py-1.5 hover:bg-muted"
                    onClick={() => setOpenNotes(false)}
                  >
                    <div className="text-xs font-medium">{note.title}</div>
                    <div className="text-[11px] text-muted-foreground">{note.body}</div>
                  </Link>
                ))
              ) : (
                <div className="px-2 py-6 text-center text-xs text-muted-foreground">
                  No notifications
                </div>
              )}
            </div>
          </div>
        ) : null}
        <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-5">{children}</main>
      </div>
    </div>
  );
}
