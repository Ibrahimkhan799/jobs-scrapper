import { cn } from '@/lib/utils';

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[1.35rem] font-medium tracking-[-0.03em]">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions}
    </div>
  );
}

export function StatusStrip({
  items,
}: {
  items: Array<{ label: string; value: number | string; hint?: string }>;
}) {
  return (
    <p className="border-b border-border pb-3 text-sm text-muted-foreground">
      {items.map((item, index) => (
        <span key={item.label}>
          {index > 0 ? <span aria-hidden className="mx-2 text-border">·</span> : null}
          <span className="tabular font-medium text-foreground">{item.value}</span> {item.label}
          {item.hint ? <span className="text-muted-foreground"> {item.hint}</span> : null}
        </span>
      ))}
    </p>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-start border border-dashed border-border px-5 py-12">
      <div className="text-sm font-medium">{title}</div>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse bg-muted', className)} />;
}
