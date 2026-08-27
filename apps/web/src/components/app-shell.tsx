'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from 'next-themes';
import { api, apiSend } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';

const NAV = [
  { href: '/', label: 'Today', key: 'd' },
  { href: '/jobs', label: 'Jobs', key: 'j' },
  { href: '/applications', label: 'Applications', key: 'a' },
  { href: '/profile', label: 'Profile', key: 'p' },
  { href: '/search', label: 'Search', key: 's' },
  { href: '/analytics', label: 'Analytics', key: 'n' },
  { href: '/settings', label: 'Settings', key: ',' },
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
      <aside className="sticky top-0 hidden h-screen w-[200px] shrink-0 flex-col border-r border-border bg-sidebar px-3 py-4 md:flex">
        <div className="mb-6 px-2">
          <div className="text-[15px] font-medium tracking-[-0.03em]">Job Hunter</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">Local matching</div>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5">
          {NAV.map((item) => {
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground',
                  active && 'bg-muted text-foreground',
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <p className="px-2 text-[10px] leading-4 text-muted-foreground">
          Match Score is similarity, not a hiring probability.
        </p>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-11 items-center justify-between border-b border-border bg-background/95 px-4">
          <nav className="flex gap-3 overflow-x-auto text-sm md:hidden">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'shrink-0 py-2 text-muted-foreground',
                  (item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)) && 'text-foreground',
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              aria-label="Notifications"
              onClick={() => setOpenNotes((v) => !v)}
            >
              Notices{unread > 0 ? ` (${unread})` : ''}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Toggle theme"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? 'Light' : 'Dark'}
            </Button>
          </div>
        </header>
        {openNotes ? (
          <div className="absolute right-4 top-11 z-30 w-80 border border-border bg-card p-2 shadow-[0_8px_24px_-12px_rgba(28,30,28,0.35)]">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-xs font-medium">Notifications</span>
              <button className="text-xs text-score" onClick={() => markRead.mutate()}>
                Mark all read
              </button>
            </div>
            <div className="max-h-80 space-y-1 overflow-auto">
              {notes.data?.length ? (
                notes.data.map((note) => (
                  <Link
                    key={note.id}
                    href={note.href ?? '/'}
                    className="block px-2 py-1.5 hover:bg-muted"
                    onClick={() => setOpenNotes(false)}
                  >
                    <div className="text-xs font-medium">{note.title}</div>
                    <div className="text-[11px] text-muted-foreground">{note.body}</div>
                  </Link>
                ))
              ) : (
                <div className="px-2 py-6 text-center text-xs text-muted-foreground">No notifications</div>
              )}
            </div>
          </div>
        ) : null}
        <main className="mx-auto w-full max-w-[1180px] flex-1 px-4 py-6">{children}</main>
      </div>
    </div>
  );
}
