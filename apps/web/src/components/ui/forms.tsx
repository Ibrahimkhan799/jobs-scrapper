import * as React from 'react';
import { cn } from '@/lib/utils';

export function Input({ className, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      className={cn(
        'h-8 w-full border border-border bg-card px-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-ring',
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn(
        'min-h-32 w-full border border-border bg-card px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-ring',
        className,
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: React.ComponentProps<'label'>) {
  return <label className={cn('text-xs font-medium text-muted-foreground', className)} {...props} />;
}

export function Badge({
  className,
  tone = 'zinc',
  ...props
}: React.ComponentProps<'span'> & { tone?: 'zinc' | 'blue' | 'green' | 'amber' | 'red' }) {
  const tones = {
    zinc: 'bg-muted text-muted-foreground',
    blue: 'bg-muted text-foreground',
    green: 'bg-score/10 text-score',
    amber: 'bg-muted text-muted-foreground',
    red: 'bg-danger/10 text-danger',
  };
  return (
    <span className={cn('inline-flex items-center px-1.5 py-0.5 text-[11px] font-medium', tones[tone], className)} {...props} />
  );
}
