'use client';

import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '@/lib/api';
import { PageHeader, StatusStrip, Skeleton } from '@/components/ui/page';

type Analytics = {
  jobsDiscovered: number;
  jobsMatched: number;
  applicationsSent: number;
  responseRate: number;
  interviewRate: number;
  offerRate: number;
  averageMatchScore: number;
  byLocation: Record<string, number>;
  byRole: Record<string, number>;
  bySource: Record<string, number>;
  disclaimer: string;
};

function toRows(record: Record<string, number>) {
  return Object.entries(record)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
}

export default function AnalyticsPage() {
  const query = useQuery({ queryKey: ['analytics'], queryFn: () => api<Analytics>('/analytics') });
  if (query.isLoading) return <Skeleton className="h-96" />;
  if (!query.data) return <p className="text-sm text-danger">Failed to load analytics.</p>;
  const data = query.data;

  return (
    <div>
      <PageHeader title="Analytics" description={data.disclaimer} />
      <StatusStrip
        items={[
          { label: 'discovered', value: data.jobsDiscovered },
          { label: 'matched', value: data.jobsMatched },
          { label: 'sent', value: data.applicationsSent },
          { label: 'avg score', value: data.averageMatchScore },
          { label: 'response', value: `${data.responseRate}%` },
          { label: 'interview', value: `${data.interviewRate}%` },
          { label: 'offer', value: `${data.offerRate}%` },
        ]}
      />
      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        <Chart title="By location" rows={toRows(data.byLocation)} />
        <Chart title="By role" rows={toRows(data.byRole)} />
        <Chart title="By source" rows={toRows(data.bySource)} />
      </div>
    </div>
  );
}

function Chart({ title, rows }: { title: string; rows: Array<{ name: string; value: number }> }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-medium">{title}</h2>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 8 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
            <Tooltip
              contentStyle={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
                fontSize: 12,
              }}
            />
            <Bar dataKey="value" fill="var(--score)" radius={0} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
