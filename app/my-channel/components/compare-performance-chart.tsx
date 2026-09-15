'use client';

import { useState } from 'react';
import { Activity } from 'lucide-react';
import { formatNumber } from '@/lib/youtube/utils';
import { type ChannelSnapshot } from '@/app/providers/channel-provider';
import { cn, ChartPeriod, ChartMetric } from './helpers';
import { TabBtn, Toggle } from './ui-atoms';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
} from 'recharts';

export function ComparePerformanceChart({ snapshots }: { snapshots: ChannelSnapshot[] }) {
  const [period,    setPeriod]    = useState<ChartPeriod>('60');
  const [metric,    setMetric]    = useState<ChartMetric>('views');
  const [normalize, setNormalize] = useState(false);

  const metrics: { key: ChartMetric; label: string }[] = [
    { key: 'views',       label: 'Views' },
    { key: 'subscribers', label: 'Subscribers' },
    { key: 'videos',      label: 'Public videos' },
  ];

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - parseInt(period));

  const filtered = snapshots
    .filter(s => new Date(s.snapshot_date) >= cutoff)
    .sort((a, b) => new Date(a.snapshot_date).getTime() - new Date(b.snapshot_date).getTime());

  const getVal = (s: ChannelSnapshot) => {
    if (metric === 'subscribers') return s.subscriber_count;
    if (metric === 'videos')      return s.video_count;
    return s.view_count;
  };

  const firstVal = filtered.length > 0 ? getVal(filtered[0]) || 1 : 1;

  const chartData = filtered.map(s => ({
    date:  s.snapshot_date.slice(5),
    value: normalize ? parseFloat((getVal(s) / firstVal).toFixed(3)) : getVal(s),
  }));

  return (
    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-purple-500/15 flex items-center justify-center">
            <Activity className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <h2 className="text-sm font-semibold text-[hsl(var(--foreground))]">Compare Performance</h2>
        </div>
        <div className="flex gap-1">
          {(['30', '60', '365'] as ChartPeriod[]).map(p => (
            <TabBtn key={p} active={period === p} onClick={() => setPeriod(p)}>
              {p === '365' ? '12 Months' : `${p} Days`}
            </TabBtn>
          ))}
        </div>
      </div>

      <div className="flex gap-6">
        {/* Metric list */}
        <div className="flex flex-col gap-1 shrink-0">
          {metrics.map(m => (
            <button key={m.key} onClick={() => setMetric(m.key)}
              className={cn(
                'text-xs text-left px-2 py-1 rounded-lg transition-colors',
                metric === m.key
                  ? 'text-[hsl(var(--foreground))] font-semibold bg-white/5'
                  : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]',
              )}>
              {m.label}
            </button>
          ))}
        </div>

        {/* Chart area */}
        <div className="flex-1 min-w-0">
          {snapshots.length > 0 ? (
            <>
              <div className="flex justify-end mb-3">
                <Toggle enabled={normalize} onChange={setNormalize} label="Normalize Data" />
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false} axisLine={false} width={48}
                    tickFormatter={(v) => normalize ? `${v}x` : formatNumber(v)}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 8,
                      fontSize: 11,
                    }}
                    formatter={(v: any) => [normalize ? `${v}x` : formatNumber(v), metric]}
                  />
                  <Line
                    type="monotone" dataKey="value"
                    stroke="hsl(var(--primary))" strokeWidth={2}
                    dot={false} activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </>
          ) : (
            <div className="flex items-center justify-center py-14 text-[hsl(var(--muted-foreground))]">
              <div className="text-center">
                <Activity className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No snapshot data yet.</p>
                <p className="text-xs mt-1 opacity-70">Sync daily to build performance history.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
