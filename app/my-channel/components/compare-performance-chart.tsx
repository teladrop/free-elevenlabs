'use client';

import { useState, useEffect, useMemo } from 'react';
import { Activity, Loader2, RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { formatNumber } from '@/lib/youtube/utils';
import { authHeaders } from './helpers';
import { TabBtn } from './ui-atoms';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceLine,
  Tooltip as RechartsTooltip, ResponsiveContainer, Cell,
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

// ─── Color palette for competitors ───────────────────────────────────────────
const COMP_COLORS = [
  '#60a5fa', // blue
  '#34d399', // emerald
  '#fbbf24', // amber
  '#f87171', // red
  '#38bdf8', // sky
  '#fb923c', // orange
  '#e879f9', // fuchsia
  '#a3e635', // lime
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getVal(s: Snapshot, metric: ChartMetric): number {
  if (metric === 'subscribers') return s.subscriber_count;
  if (metric === 'videos')      return s.video_count;
  return s.view_count;
}

/** Get the latest snapshot value for a series on or before a given date */
function getLatestVal(
  snapMap: Map<string, number>,
  allDates: string[],
  targetDate: string,
): number | null {
  // Walk backwards from targetDate to find the most recent value
  const idx = allDates.indexOf(targetDate);
  for (let i = idx; i >= 0; i--) {
    const v = snapMap.get(allDates[i]);
    if (v !== undefined) return v;
  }
  return null;
}

function fmtDate(d: string): string {
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Format gap: +1.2M, -450K, ±0 */
function fmtGap(n: number): string {
  const abs = Math.abs(n);
  const str = abs >= 1_000_000
    ? `${(abs / 1_000_000).toFixed(1)}M`
    : abs >= 1_000
    ? `${(abs / 1_000).toFixed(1)}K`
    : String(abs);
  return n >= 0 ? `+${str}` : `-${str}`;
}

/**
 * Build gap chart data.
 *
 * For each date in the period, for each competitor:
 *   gap = myChannelValue(date) - competitorValue(date)
 *
 * Positive gap = you are ahead. Negative = you are behind.
 * Uses the latest available snapshot value for each channel on that date
 * (forward-fills missing days so bars accumulate naturally).
 */
function buildGapData(
  myChannel:   ChannelSeries,
  competitors: ChannelSeries[],
  metric:      ChartMetric,
  since:       Date,
): { date: string; label: string; [key: string]: any }[] {
  // Collect all dates from all series within range
  const dateSet = new Set<string>();
  const addSnaps = (s: ChannelSeries) =>
    s.snapshots
      .filter(sn => new Date(sn.snapshot_date) >= since)
      .forEach(sn => dateSet.add(sn.snapshot_date));

  addSnaps(myChannel);
  competitors.forEach(addSnaps);

  const allDates = [...dateSet].sort();
  if (allDates.length === 0) return [];

  // Build lookup maps
  const myMap = new Map<string, number>();
  myChannel.snapshots.forEach(sn => myMap.set(sn.snapshot_date, getVal(sn, metric)));

  const compMaps = competitors.map(c => {
    const m = new Map<string, number>();
    c.snapshots.forEach(sn => m.set(sn.snapshot_date, getVal(sn, metric)));
    return m;
  });

  return allDates.map(date => {
    const row: any = { date, label: fmtDate(date) };
    const myVal = getLatestVal(myMap, allDates, date);

    competitors.forEach((comp, i) => {
      const compVal = getLatestVal(compMaps[i], allDates, date);
      if (myVal !== null && compVal !== null) {
        row[comp.label] = myVal - compVal;
      }
    });

    return row;
  });
}

// ─── Gap summary cards ────────────────────────────────────────────────────────

interface GapSummary {
  label:    string;
  avatar?:  string;
  color:    string;
  gap:      number | null;   // latest gap value
  trend:    number | null;   // gap at start of period
}

function computeGapSummaries(
  myChannel:   ChannelSeries,
  competitors: ChannelSeries[],
  metric:      ChartMetric,
  since:       Date,
): GapSummary[] {
  const allDates = [...new Set([
    ...myChannel.snapshots.map(s => s.snapshot_date),
    ...competitors.flatMap(c => c.snapshots.map(s => s.snapshot_date)),
  ])].filter(d => new Date(d) >= since).sort();

  if (allDates.length === 0) return [];

  const myMap = new Map<string, number>();
  myChannel.snapshots.forEach(sn => myMap.set(sn.snapshot_date, getVal(sn, metric)));

  return competitors.map((comp, i) => {
    const compMap = new Map<string, number>();
    comp.snapshots.forEach(sn => compMap.set(sn.snapshot_date, getVal(sn, metric)));

    const lastDate  = allDates[allDates.length - 1];
    const firstDate = allDates[0];

    const myLast    = getLatestVal(myMap,   allDates, lastDate);
    const compLast  = getLatestVal(compMap, allDates, lastDate);
    const myFirst   = getLatestVal(myMap,   allDates, firstDate);
    const compFirst = getLatestVal(compMap, allDates, firstDate);

    const latestGap = (myLast !== null && compLast !== null) ? myLast - compLast : null;
    const startGap  = (myFirst !== null && compFirst !== null) ? myFirst - compFirst : null;
    // trend = how much the gap changed (positive = gap widened in your favour)
    const trend     = (latestGap !== null && startGap !== null) ? latestGap - startGap : null;

    return {
      label:   comp.label,
      avatar:  comp.avatar,
      color:   COMP_COLORS[i % COMP_COLORS.length],
      gap:     latestGap,
      trend,
    };
  });
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function GapTooltip({ active, payload, label, metric }: any) {
  if (!active || !payload?.length) return null;

  const entries = [...payload]
    .filter(e => e.value !== null && e.value !== undefined)
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-xl px-3 py-2.5 min-w-[200px]">
      <p className="text-[10px] text-[hsl(var(--muted-foreground))] mb-2 font-semibold">{label}</p>
      <p className="text-[9px] text-[hsl(var(--muted-foreground))] mb-2 opacity-70">
        You vs competitor — positive = you lead
      </p>
      {entries.map((entry: any) => {
        const gap   = entry.value as number;
        const color = entry.fill as string;
        const isAhead = gap >= 0;
        return (
          <div key={entry.dataKey} className="flex items-center justify-between gap-3 mb-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: color }} />
              <span className="text-xs text-[hsl(var(--muted-foreground))] truncate max-w-[110px]">
                vs {entry.dataKey}
              </span>
            </div>
            <span className={`text-xs font-bold whitespace-nowrap ${isAhead ? 'text-emerald-400' : 'text-red-400'}`}>
              {fmtGap(gap)} {METRIC_LABELS[metric as ChartMetric]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

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

  const since = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - parseInt(period));
    return d;
  }, [period]);

  const visibleCompetitors = useMemo(
    () => competitors.filter(c => !hidden.has(c.label)),
    [competitors, hidden],
  );

  const chartData = useMemo(() => {
    if (!myChannel) return [];
    return buildGapData(myChannel, visibleCompetitors, metric, since);
  }, [myChannel, visibleCompetitors, metric, since]);

  const gapSummaries = useMemo(() => {
    if (!myChannel || competitors.length === 0) return [];
    return computeGapSummaries(myChannel, competitors, metric, since);
  }, [myChannel, competitors, metric, since]);

  const hasData = !!myChannel && (myChannel.snapshots.length > 0 || competitors.some(c => c.snapshots.length > 0));

  const toggleSeries = (label: string) => {
    setHidden(prev => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  };

  // Y-axis: format as gap (signed, abbreviated)
  const yTickFmt = (v: number) => {
    if (v === 0) return '0';
    const abs = Math.abs(v);
    const str = abs >= 1_000_000
      ? `${(abs / 1_000_000).toFixed(1)}M`
      : abs >= 1_000
      ? `${(abs / 1_000).toFixed(0)}K`
      : String(abs);
    return v >= 0 ? `+${str}` : `-${str}`;
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
            <h2 className="text-sm font-bold text-[hsl(var(--foreground))]">Gap vs Competitors</h2>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
              Positive = you lead · Negative = you trail · Bars accumulate daily
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
            Sync daily and add competitors to build gap history.
          </p>
        </div>
      ) : (
        <div className="space-y-5">

          {/* Metric selector */}
          <div className="flex gap-1.5 flex-wrap">
            {(['subscribers', 'views', 'videos'] as ChartMetric[]).map(m => (
              <button key={m} onClick={() => setMetric(m)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                  metric === m
                    ? 'bg-purple-500/15 text-purple-400 border-purple-500/30'
                    : 'text-[hsl(var(--muted-foreground))] border-[hsl(var(--border))] hover:text-[hsl(var(--foreground))]'
                }`}>
                {METRIC_LABELS[m]}
              </button>
            ))}
          </div>

          {/* Gap summary row — one card per competitor */}
          {gapSummaries.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {gapSummaries.map(s => {
                const isAhead  = s.gap !== null && s.gap >= 0;
                const isBehind = s.gap !== null && s.gap < 0;
                const gapClosing = s.trend !== null && s.trend > 0;
                return (
                  <button
                    key={s.label}
                    onClick={() => toggleSeries(s.label)}
                    className={`text-left rounded-xl border p-3 transition-all ${
                      hidden.has(s.label)
                        ? 'opacity-40 border-[hsl(var(--border))] bg-[hsl(var(--background))]'
                        : isAhead
                          ? 'border-emerald-500/25 bg-emerald-500/6'
                          : 'border-red-500/25 bg-red-500/6'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      {s.avatar ? (
                        <img src={s.avatar} alt={s.label} className="w-6 h-6 rounded-full object-cover shrink-0" />
                      ) : (
                        <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: s.color }} />
                      )}
                      <span className="text-xs text-[hsl(var(--muted-foreground))] truncate">{s.label}</span>
                    </div>
                    {s.gap !== null ? (
                      <>
                        <div className={`text-lg font-bold leading-none ${isAhead ? 'text-emerald-400' : 'text-red-400'}`}>
                          {fmtGap(s.gap)}
                        </div>
                        <div className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1">
                          {METRIC_LABELS[metric]} gap
                        </div>
                        {s.trend !== null && Math.abs(s.trend) > 0 && (
                          <div className={`flex items-center gap-1 mt-1.5 text-[10px] font-semibold ${gapClosing ? 'text-emerald-400' : 'text-red-400'}`}>
                            {gapClosing ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {gapClosing ? 'Gap closing' : 'Gap widening'} {fmtGap(Math.abs(s.trend))} this period
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-xs text-[hsl(var(--muted-foreground))] opacity-60">No data</div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Chart */}
          {competitors.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-center">
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                Add competitors to see gap analysis.
              </p>
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-center">
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                No overlapping data yet — sync daily to build history.
              </p>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={chartData}
                  margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
                  barCategoryGap="25%"
                  barGap={2}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} vertical={false} />
                  <ReferenceLine y={0} stroke="hsl(var(--border))" strokeWidth={1.5} />
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
                    width={56}
                    tickFormatter={yTickFmt}
                  />
                  <RechartsTooltip
                    content={<GapTooltip metric={metric} />}
                    cursor={{ fill: 'hsl(var(--border))', opacity: 0.15 }}
                  />
                  {visibleCompetitors.map((comp, i) => {
                    const color = COMP_COLORS[competitors.indexOf(comp) % COMP_COLORS.length];
                    return (
                      <Bar
                        key={comp.label}
                        dataKey={comp.label}
                        radius={[3, 3, 0, 0]}
                        maxBarSize={20}
                      >
                        {chartData.map((entry, idx) => {
                          const val = entry[comp.label];
                          const isPositive = typeof val === 'number' && val >= 0;
                          return (
                            <Cell
                              key={`cell-${idx}`}
                              fill={color}
                              fillOpacity={isPositive ? 0.85 : 0.5}
                            />
                          );
                        })}
                      </Bar>
                    );
                  })}
                </BarChart>
              </ResponsiveContainer>

              <p className="text-[10px] text-[hsl(var(--muted-foreground))] text-center">
                Each bar = your {METRIC_LABELS[metric].toLowerCase()} minus competitor's on that date.
                Above zero line = you lead · Below = you trail.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
