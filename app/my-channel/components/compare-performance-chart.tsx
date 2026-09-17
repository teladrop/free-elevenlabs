'use client';

import { useState, useEffect, useMemo } from 'react';
import { Activity, Loader2, RefreshCw } from 'lucide-react';
import { formatNumber } from '@/lib/youtube/utils';
import { authHeaders } from './helpers';
import { TabBtn, Toggle } from './ui-atoms';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Snapshot {
  snapshot_date:    string;
  subscriber_count: number;
  view_count:       number;
  video_count:      number;
}

interface ChannelSeries {
  id?:       string;
  label:     string;
  avatar?:   string;
  isOwn:     boolean;
  snapshots: Snapshot[];
}

type ChartPeriod = '30' | '60' | '365';
type ChartMetric = 'subscribers' | 'views' | 'videos';

// ─── Colour palette (up to 9 channels) ───────────────────────────────────────

const COLORS = [
  '#a78bfa', // purple  (own channel)
  '#60a5fa', // blue
  '#34d399', // emerald
  '#fbbf24', // amber
  '#f87171', // red
  '#38bdf8', // sky
  '#fb923c', // orange
  '#a3e635', // lime
  '#e879f9', // fuchsia
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getVal(s: Snapshot, metric: ChartMetric): number {
  if (metric === 'subscribers') return s.subscriber_count;
  if (metric === 'videos')      return s.video_count;
  return s.view_count;
}

/** Format date as "Jan 5" */
function fmtDate(d: string): string {
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Build a unified date-keyed table across all series */
function buildChartData(
  series:    ChannelSeries[],
  metric:    ChartMetric,
  normalize: boolean,
  since:     Date,
): { date: string; label: string; [key: string]: any }[] {
  // Collect all dates across every series
  const dateSet = new Set<string>();
  series.forEach(s =>
    s.snapshots
      .filter(snap => new Date(snap.snapshot_date) >= since)
      .forEach(snap => dateSet.add(snap.snapshot_date)),
  );

  const dates = [...dateSet].sort();
  if (dates.length === 0) return [];

  // For each series, build a lookup map date → value
  const maps = series.map(s => {
    const m = new Map<string, number>();
    s.snapshots.forEach(snap => m.set(snap.snapshot_date, getVal(snap, metric)));
    return m;
  });

  // Normalisation base: first available value per series
  const bases = series.map((_, i) => {
    for (const d of dates) {
      const v = maps[i].get(d);
      if (v && v > 0) return v;
    }
    return 1;
  });

  return dates.map(date => {
    const row: any = { date, label: fmtDate(date) };
    series.forEach((s, i) => {
      const raw = maps[i].get(date);
      if (raw !== undefined) {
        row[s.label] = normalize
          ? parseFloat((raw / bases[i]).toFixed(3))
          : raw;
      }
    });
    return row;
  });
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label, normalize, metric }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-xl px-3 py-2.5 min-w-[160px]">
      <p className="text-[10px] text-[hsl(var(--muted-foreground))] mb-2 font-semibold">{label}</p>
      {[...payload].sort((a, b) => (b.value ?? 0) - (a.value ?? 0)).map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center justify-between gap-4 mb-1">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.stroke }} />
            <span className="text-xs text-[hsl(var(--muted-foreground))] truncate max-w-[100px]">{entry.dataKey}</span>
          </div>
          <span className="text-xs font-semibold text-[hsl(var(--foreground))]">
            {normalize ? `${entry.value}x` : formatNumber(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ComparePerformanceChart() {
  const [period,     setPeriod]     = useState<ChartPeriod>('60');
  const [metric,     setMetric]     = useState<ChartMetric>('views');
  const [normalize,  setNormalize]  = useState(false);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [myChannel,  setMyChannel]  = useState<ChannelSeries | null>(null);
  const [competitors, setCompetitors] = useState<ChannelSeries[]>([]);
  const [hidden,     setHidden]     = useState<Set<string>>(new Set());

  const fetchData = async (days: string) => {
    setLoading(true); setError('');
    try {
      const hdrs = await authHeaders();
      const res  = await fetch(`/api/my-channel/competitor-snapshots?days=${days}`, { headers: hdrs });
      if (!res.ok) throw new Error('Failed to load snapshot data');
      const d = await res.json();
      setMyChannel(d.myChannel);
      setCompetitors(d.competitors ?? []);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(period); }, [period]);

  // All series: own channel first, then competitors
  const allSeries = useMemo((): ChannelSeries[] => {
    const s: ChannelSeries[] = [];
    if (myChannel) s.push(myChannel);
    s.push(...competitors);
    return s;
  }, [myChannel, competitors]);

  // Visible series (not hidden)
  const visibleSeries = useMemo(
    () => allSeries.filter(s => !hidden.has(s.label)),
    [allSeries, hidden],
  );

  const since = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - parseInt(period));
    return d;
  }, [period]);

  const chartData = useMemo(
    () => buildChartData(visibleSeries, metric, normalize, since),
    [visibleSeries, metric, normalize, since],
  );

  const hasData = allSeries.some(s => s.snapshots.length > 0);

  const metrics: { key: ChartMetric; label: string }[] = [
    { key: 'views',       label: 'Views'       },
    { key: 'subscribers', label: 'Subscribers' },
    { key: 'videos',      label: 'Videos'      },
  ];

  const toggleSeries = (label: string) => {
    setHidden(prev => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  };

  return (
    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-purple-500/15 flex items-center justify-center">
            <Activity className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[hsl(var(--foreground))]">Compare Performance</h2>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
              Your channel vs competitors over time
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => fetchData(period)} disabled={loading}
            className="p-1.5 rounded-lg text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-white/5 transition-colors disabled:opacity-40">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {(['30', '60', '365'] as ChartPeriod[]).map(p => (
            <TabBtn key={p} active={period === p} onClick={() => setPeriod(p)}>
              {p === '365' ? '1Y' : `${p}d`}
            </TabBtn>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-7 h-7 animate-spin text-purple-400" />
        </div>
      ) : error ? (
        <div className="flex items-center justify-center py-14 text-red-400 text-sm">{error}</div>
      ) : !hasData ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Activity className="w-10 h-10 mx-auto mb-3 text-[hsl(var(--muted-foreground))] opacity-30" />
          <p className="text-sm text-[hsl(var(--muted-foreground))]">No snapshot data yet.</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] opacity-60 mt-1">
            Sync daily and add competitors to build performance history.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Controls row */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Metric pills */}
            <div className="flex gap-1 flex-wrap">
              {metrics.map(m => (
                <button key={m.key} onClick={() => setMetric(m.key)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                    metric === m.key
                      ? 'bg-purple-500/15 text-purple-400 border-purple-500/30'
                      : 'text-[hsl(var(--muted-foreground))] border-[hsl(var(--border))] hover:text-[hsl(var(--foreground))] hover:border-[hsl(var(--primary))/30]'
                  }`}>
                  {m.label}
                </button>
              ))}
            </div>
            <Toggle enabled={normalize} onChange={setNormalize} label="Normalize" />
          </div>

          {/* Channel legend / toggle pills */}
          <div className="flex flex-wrap gap-2">
            {allSeries.map((s, i) => {
              const color  = COLORS[i % COLORS.length];
              const active = !hidden.has(s.label);
              return (
                <button key={s.label} onClick={() => toggleSeries(s.label)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                    active
                      ? 'border-white/10 bg-white/5 text-[hsl(var(--foreground))]'
                      : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] opacity-40'
                  }`}>
                  {s.avatar ? (
                    <img src={s.avatar} alt={s.label}
                      className="w-4 h-4 rounded-full object-cover" style={{ opacity: active ? 1 : 0.4 }} />
                  ) : (
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  )}
                  <span className="max-w-[120px] truncate">
                    {s.isOwn ? `${s.label} (you)` : s.label}
                  </span>
                  {s.snapshots.length === 0 && (
                    <span className="text-[9px] text-[hsl(var(--muted-foreground))] opacity-60">no data</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Chart */}
          {chartData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                No data in the selected period.
              </p>
              <p className="text-xs text-[hsl(var(--muted-foreground))] opacity-60 mt-1">
                Try extending the time range or syncing your channel.
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.35} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                  width={52}
                  tickFormatter={v => normalize ? `${v}x` : formatNumber(v)}
                />
                <RechartsTooltip
                  content={<CustomTooltip normalize={normalize} metric={metric} />}
                />
                {visibleSeries.map((s, i) => (
                  <Line
                    key={s.label}
                    type="monotone"
                    dataKey={s.label}
                    stroke={COLORS[allSeries.indexOf(s) % COLORS.length]}
                    strokeWidth={s.isOwn ? 2.5 : 1.5}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                    connectNulls
                    strokeDasharray={s.isOwn ? undefined : undefined}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}

          {normalize && (
            <p className="text-[10px] text-[hsl(var(--muted-foreground))] text-center">
              Normalized: 1.0 = first data point for each channel.
              Values above 1.0 show growth relative to that baseline.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
