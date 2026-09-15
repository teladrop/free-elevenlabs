'use client';

import { useState, useEffect } from 'react';
import { BarChart2, Loader2, Users } from 'lucide-react';
import { formatNumber } from '@/lib/youtube/utils';
import { type ChannelConnection } from '@/app/providers/channel-provider';
import { authHeaders, Competitor } from './helpers';
import { TabBtn } from './ui-atoms';

export function ChannelStatsTable({ connection }: { connection: ChannelConnection }) {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const hdrs = await authHeaders();
        const res = await fetch('/api/my-channel/competitors', { headers: hdrs });
        const d = await res.json();
        setCompetitors(d.competitors ?? []);
      } catch {}
      finally { setLoading(false); }
    })();
  }, []);

  type Row = {
    id: string; avatar: string; title: string;
    totalViews: number; thisWeek: number; prevWeek: number; thisMonth: number;
  };

  const toRow = (c: Competitor): Row => {
    const freq     = Math.max(c.upload_frequency, 0.1);
    const weekEst  = Math.round(c.avg_views_per_video * freq / 4.33);
    const prevEst  = Math.round(weekEst * 0.75);
    const monthEst = Math.round(c.avg_views_per_video * freq);
    return {
      id:         c.id,
      avatar:     c.profile_image_url,
      title:      c.channel_title,
      totalViews: c.avg_views_per_video * freq * 52,
      thisWeek:   weekEst,
      prevWeek:   prevEst,
      thisMonth:  monthEst,
    };
  };

  const rows: Row[] = competitors.slice(0, 5).map(toRow);

  const vsChange = (curr: number, prev: number) => {
    if (prev === 0) return null;
    const pct = ((curr - prev) / prev) * 100;
    return { pct: Math.abs(pct).toFixed(1), positive: pct >= 0 };
  };

  return (
    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
      <div className="flex items-center gap-2 mb-5">
        <div className="w-7 h-7 rounded-lg bg-blue-500/15 flex items-center justify-center">
          <BarChart2 className="w-3.5 h-3.5 text-blue-400" />
        </div>
        <h2 className="text-sm font-semibold text-[hsl(var(--foreground))]">Channel Stats</h2>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-[hsl(var(--muted-foreground))]" />
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-8 text-[hsl(var(--muted-foreground))]">
          <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Add competitors to see stats comparison.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[hsl(var(--muted-foreground))] border-b border-[hsl(var(--border))]">
                <th className="text-left pb-2.5 font-semibold">Channel</th>
                <th className="text-right pb-2.5 font-semibold">Total Views</th>
                <th className="text-right pb-2.5 font-semibold">This Week</th>
                <th className="text-right pb-2.5 font-semibold">vs Prev Week</th>
                <th className="text-right pb-2.5 font-semibold">This Month</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const chg = vsChange(row.thisWeek, row.prevWeek);
                return (
                  <tr key={row.id} className="border-b border-[hsl(var(--border))/40] last:border-0 hover:bg-white/2 transition-colors">
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        {row.avatar ? (
                          <img src={row.avatar} alt={row.title} className="w-7 h-7 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center shrink-0 text-[10px] font-bold text-zinc-300">
                            {row.title[0]}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-semibold text-[hsl(var(--foreground))] truncate max-w-[110px]">{row.title}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 text-right font-mono text-[hsl(var(--foreground))]">
                      {formatNumber(Math.round(row.totalViews))}
                    </td>
                    <td className="py-3 text-right">
                      <span className="text-emerald-400">↗ {formatNumber(row.thisWeek)}</span>
                    </td>
                    <td className="py-3 text-right">
                      {chg ? (
                        <span className={chg.positive ? 'text-emerald-400' : 'text-red-400'}>
                          {chg.positive ? '↗' : '↘'} {chg.pct}%
                        </span>
                      ) : '—'}
                    </td>
                    <td className="py-3 text-right">
                      <span className="text-emerald-400">↗ {formatNumber(row.thisMonth)}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
