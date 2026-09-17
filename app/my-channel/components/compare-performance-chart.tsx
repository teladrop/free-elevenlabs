'use client';

import { useState, useEffect, useMemo } from 'react';
import { Activity, Loader2, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import { formatNumber } from '@/lib/youtube/utils';
import { authHeaders } from './helpers';
import { TabBtn } from './ui-atoms';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, ReferenceLine,
  Tooltip as RechartsTooltip, ResponsiveContainer,
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

const METRIC_LABELS: Record<ChartMetric, string> = {
  views:       'Views',
  subscribers: 'Subscribers',
  videos:      'Videos',
};

// Each competitor gets its own color line
const LINE_COLORS = [
  '#60a5fa', // blue
  '#34d399', // emerald
  '#fbbf24', // amber
  '#f87171', // red
  '#e879f9', // fuchsia
  '#38bdf8', // sky
  '#fb923c', // orange
  '#a3e635', // lime
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getVal(s: Snapshot, metric: ChartMetric): number {
  if (metric === 'subscribers') return s.subscriber_count;
  if (metric === 'videos')      return s.video_count;
  return s.view_count;
}

function fmtDate(d: string): string {
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtGap(n: number): string {
  const abs = Math.abs(n);
  const str =
    abs >= 1_000_000 ? `${(abs / 1_000_000).toFixed(1)}M` :
    abs >= 1_000     ? `${(abs / 1_000).toFixed(1)}K` :
    String(abs);
  return n > 0 ? `+${str}` : n < 0 ? `-${str}` : '0';
}

/** Get latest known value on or before targetDate */
function latestVal(
  map: Map<string, number>,
  sortedDates: string[],
  targetDate: string,
): number | null {
  const idx = sortedDates.indexOf(targetDate);
  for (let i = idx; i >= 0; i--) {
    const v = map.get(sortedDates[i]);
    if (v !== undefined) return v;
  }
  return null;
}

/**
 * Build chart data.
 * X-axis = dates. For each competitor, the value = myValue - compValue (the gap).
 * Zero = you and competitor are equal. Positive = you lead. Negative = you trail.
 */
function buildGapLines(
  myChannel:   ChannelSeries,
  competitors: ChannelSeries[],
  metric:      ChartMetric,
  since:       Date,
) {
  const dateSet = new Set<string>();
  const addSnaps = (s: ChannelSeries) =>
    s.snapshots
      .filter(sn => new Date(sn.snapshot_date) >= since)
      .forEach(sn => dateSet.add(sn.snapshot_date));

  addSnaps(myChannel);
  competitors.forEach(addSnaps);

  const allDates = [...dateSet].sort();
  if (allDates.length === 0) return [];

  const myMap = new Map<string, number>();
  myChannel.snapshots.forEach(sn => myMap.set(sn.snapshot_date, getVal(sn, metric)));

  const compMaps = competitors.map(c => {
    const m = new Map<string, number>();
    c.snapshots.forEach(sn => m.set(sn.snapshot_date, getVal(sn, metric)));
    return m;
  });

  return allDates.map(date => {
    const myVal = latestVal(myMap, allDates, date);
    const row: Record<string, any> = { date, label: fmtDate(date) };
    competitors.forEach((comp, i) => {
      const cv = latestVal(compMaps[i], allDates, date);
      if (myVal !== null && cv !== null) {
        row[comp.label] = myVal - cv;
      }
    });
    return row;
  });
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function GapTooltip({ active, payload, label, metric }: any) {
  if (!active || !payload?.length) return null;
  const entries = [...payload]
    .filter(e => e.value !== null && e.value !== undefined)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-2xl px-3 py-2.5 min-w-[200px]">
      <p className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] mb-2">{label}</p>
      {entries.map((e: any) => {
        const gap   = e.value as number;
        const ahead = gap >= 0;
        return (
          <div key={e.dataKey} className="flex items-center justify-between gap-3 mb-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: e.stroke }} />
              <span className="text-xs text-[hsl(var(--muted-foreground))] truncate max-w-[110px]">
                vs {e.dataKey}
              </span>
            </div>
            <span className={`text-xs font-bold whitespace-nowrap ${ahead ? 'text-emerald-400' : 'text-red-400'}`}>
              {fmtGap(gap)} {METRIC_LABELS[metric as ChartMetric]}
            </span>
          </div>
        );
      })}
      <p className="text-[9px] text-[hsl(var(--muted-foreground))] opacity-50 mt-1.5 border-t border-[hsl(var(--border))] pt-1.5">
        + = you lead · − = you trail
      </p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ComparePerformanceChart() {
  const [period,      setPeriod]      = useState<ChartPeriod>('60');
  const [metric,      setMetric]      = useState<ChartMetric>('subscribers');
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [myChannel,   setMyChannel]   = useState<ChannelSeries | null>(null);
  const [competitors, setCompetitors] = useState<ChannelSeries[]>([]);
  const [hidden,      setHidden]      = useState<Set<string>>(new Set());

  const fetchData = async (days: string) => {
    setLoading(true); setError('');
    try {
      const hdrs = await authHeaders();
      const res  = await fetch(`/api/my-channel/competitor-snapshots?days=${days}`, { headers: hdrs });
      if (!res.ok) throw new Error('Failed to load data');
      const d = await res.json();
      setMyChannel(d.myChannel);
      setCompetitors(d.competitors ?? []);
    } catch (e: any) {
      setError(e.message ?? 'Error loading data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(period); }, [period]);

  const since = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - parseInt(period));
    return d;
  }, [period]);

  const visibleComps = useMemo(
    () => competitors.filter(c => !hidden.has(c.label)),
    [competitors, hidden],
  );

  const chartData = useMemo(() => {
    if (!myChannel || competitors.length === 0) return [];
    return buildGapLines(myChannel, visibleComps, metric, since);
  }, [myChannel, visibleComps, metric, since]);

  const hasData = !!myChannel && competitors.length > 0;

  const toggle = (label: string) =>
    setHidden(prev => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });

  // Y-axis tick formatter: signed abbreviated numbers
  const yFmt = (v: number) => {
    if (v === 0) return '0';
    const abs = Math.abs(v);
    const s =
      abs >= 1_000_000 ? `${(abs / 1_000_000).toFixed(1)}M` :
      abs >= 1_000     ? `${(abs / 1_000).toFixed(0)}K`     :
      String(abs);
    return v > 0 ? `+${s}` : `-${s}`;
  };

  // Latest gap per competitor for the legend
  const latestGaps = useMemo(() => {
    if (!myChannel || chartData.length === 0) return new Map<string, number>();
    const last = chartData[chartData.length - 1];
    const m = new Map<string, number>();
    competitors.forEach(c => {
      if (typeof last[c.label] === 'number') m.set(c.label, last[c.label]);
    });
    return m;
  }, [myChannel, chartData, competitors]);

  return (
    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-purple-500/15 flex items-center justify-center">
            <Activity className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[hsl(var(--foreground))]">Gap vs Competitors</h2>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
              Zero line = equal · Above = you lead · Below = you trail
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchData(period)}
            disabled={loading}
            className="p-1.5 rounded-lg text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-white/5 transition-colors disabled:opacity-40"
          >
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
          <Activity className="w-10 h-10 mx-auto mb-3 opacity-20 text-[hsl(var(--muted-foreground))]" />
          <p className="text-sm font-medium text-[hsl(var(--foreground))]">No competitors added yet</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] opacity-60 mt-1">
            Add competitors above to see the gap chart.
          </p>
        </div>
      ) : (
        <div className="space-y-4">

          {/* ── Metric tabs ──────────────────────────────────────────── */}
          <div className="flex gap-1.5 flex-wrap">
            {(['subscribers', 'views', 'videos'] as ChartMetric[]).map(m => (
              <button
                key={m}
                onClick={() => setMetric(m)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                  metric === m
                    ? 'bg-purple-500/15 text-purple-400 border-purple-500/30'
                    : 'text-[hsl(var(--muted-foreground))] border-[hsl(var(--border))] hover:text-[hsl(var(--foreground))]'
                }`}
              >
                {METRIC_LABELS[m]}
              </button>
            ))}
          </div>

          {/* ── Competitor legend pills (click to toggle) ──────────── */}
          <div className="flex flex-wrap gap-2">
            {competitors.map((comp, i) => {
              const color   = LINE_COLORS[i % LINE_COLORS.length];
              const active  = !hidden.has(comp.label);
              const gap     = latestGaps.get(comp.label) ?? null;
              const isAhead = gap !== null && gap >= 0;

              return (
                <button
                  key={comp.label}
                  onClick={() => toggle(comp.label)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    active
                      ? 'bg-white/5 border-white/10 text-[hsl(var(--foreground))]'
                      : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] opacity-40'
                  }`}
                >
                  {comp.avatar ? (
                    <img src={comp.avatar} alt="" className="w-4 h-4 rounded-full object-cover shrink-0" />
                  ) : (
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  )}
                  <span className="max-w-[100px] truncate">{comp.label}</span>
                  {gap !== null && (
                    <span className={`font-bold ${isAhead ? 'text-emerald-400' : 'text-red-400'}`}>
                      {fmtGap(gap)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Chart ────────────────────────────────────────────────── */}
          {chartData.length === 0 ? (
            <div className="flex items-center justify-center py-10">
              <p className="text-sm text-[hsl(var(--muted-foreground))]">No data for this period.</p>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart
                  data={chartData}
                  margin={{ top: 10, right: 8, left: 0, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                    opacity={0.3}
                    vertical={false}
                  />
                  {/* Zero baseline — the "equal" line */}
                  <ReferenceLine
                    y={0}
                    stroke="hsl(var(--muted-foreground))"
                    strokeWidth={1}
                    strokeDasharray="4 3"
                    opacity={0.6}
                  />
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
                    width={58}
                    tickFormatter={yFmt}
                  />
                  <RechartsTooltip
                    content={<GapTooltip metric={metric} />}
                    cursor={{
                      stroke: 'hsl(var(--muted-foreground))',
                      strokeWidth: 1,
                      strokeDasharray: '3 3',
                    }}
                  />
                  {visibleComps.map((comp, i) => {
                    const colorIdx = competitors.indexOf(comp);
                    const color    = LINE_COLORS[colorIdx % LINE_COLORS.length];
                    return (
                      <Line
                        key={comp.label}
                        type="monotone"
                        dataKey={comp.label}
                        stroke={color}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 5, strokeWidth: 0, fill: color }}
                        connectNulls
                      />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>

              <p className="text-[10px] text-[hsl(var(--muted-foreground))] text-center opacity-60">
                Y-axis = your {METRIC_LABELS[metric].toLowerCase()} minus competitor's each day.
                {chartData.length === 1 && ' Sync daily to build trend history.'}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
