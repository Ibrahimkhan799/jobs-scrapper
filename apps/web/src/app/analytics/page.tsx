'use client';

import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '@/lib/api';
import { PageHeader, Metric, Skeleton } from '@/components/ui/page';

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
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric label="Jobs discovered" value={data.jobsDiscovered} />
        <Metric label="Jobs matched" value={data.jobsMatched} />
        <Metric label="Applications sent" value={data.applicationsSent} />
        <Metric label="Avg match score" value={data.averageMatchScore} />
        <Metric label="Response rate" value={`${data.responseRate}%`} />
        <Metric label="Interview rate" value={`${data.interviewRate}%`} />
        <Metric label="Offer rate" value={`${data.offerRate}%`} />
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Chart title="By location" rows={toRows(data.byLocation)} />
        <Chart title="By role" rows={toRows(data.byRole)} />
        <Chart title="By source" rows={toRows(data.bySource)} />
      </div>
    </div>
  );
}

function Chart({ title, rows }: { title: string; rows: Array<{ name: string; value: number }> }) {
  return (
    <section className="rounded-md border border-border p-3">
      <h2 className="mb-3 text-sm font-medium">{title}</h2>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 8 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="value" fill="var(--accent)" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
