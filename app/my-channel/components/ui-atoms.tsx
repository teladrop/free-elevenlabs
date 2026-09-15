'use client';

import { Loader2, CheckCircle2, TrendingUp, TrendingDown } from 'lucide-react';
import { cn, SyncStatus } from './helpers';

export function StatusBadge({ status }: { status: SyncStatus }) {
  const cfg: Record<SyncStatus, { label: string; cls: string }> = {
    connected:    { label: 'Connected',    cls: 'bg-blue-500/15 text-blue-400 border-blue-500/25' },
    syncing:      { label: 'Syncing…',     cls: 'bg-amber-500/15 text-amber-400 border-amber-500/25' },
    synced:       { label: 'Synced',       cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25' },
    sync_failed:  { label: 'Sync failed',  cls: 'bg-red-500/15 text-red-400 border-red-500/25' },
    needs_reauth: { label: 'Needs reauth', cls: 'bg-orange-500/15 text-orange-400 border-orange-500/25' },
    disconnected: { label: 'Disconnected', cls: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/25' },
  };
  const { label, cls } = cfg[status] ?? { label: status, cls: '' };
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${cls}`}>
      {status === 'syncing' && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
      {status === 'synced'  && <CheckCircle2 className="w-2.5 h-2.5" />}
      {label}
    </span>
  );
}

export function GradientStatCard({ icon, label, value, sub, gradient, delta }: {
  icon: React.ReactNode; label: string; value: string; sub?: string;
  gradient: string; delta?: { value: string; positive: boolean };
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl p-5 border border-white/5 ${gradient}`}>
      <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full blur-2xl opacity-20 bg-white/20" />
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-white">{icon}</div>
          {delta && (
            <span className={`flex items-center gap-0.5 text-[11px] font-semibold ${delta.positive ? 'text-emerald-300' : 'text-red-300'}`}>
              {delta.positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {delta.value}
            </span>
          )}
        </div>
        <div className="text-2xl font-bold text-white mb-0.5">{value}</div>
        <div className="text-xs text-white/60">{label}</div>
        {sub && <div className="text-[10px] text-white/40 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

export function TabBtn({ active, onClick, children }: {
  active: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button onClick={onClick} className={cn(
      'px-3 py-1.5 text-xs font-semibold rounded-lg transition-all',
      active ? 'bg-[hsl(var(--primary))] text-white shadow-sm' : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-white/5',
    )}>
      {children}
    </button>
  );
}

export function Toggle({ enabled, onChange, label }: {
  enabled: boolean; onChange: (v: boolean) => void; label: string;
}) {
  return (
    <button onClick={() => onChange(!enabled)} className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors">
      <div className={cn('relative w-9 h-5 rounded-full transition-colors border', enabled ? 'bg-blue-500 border-blue-400' : 'bg-zinc-700 border-zinc-600')}>
        <div className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform', enabled ? 'translate-x-4' : 'translate-x-0.5')} />
      </div>
      {label}
    </button>
  );
}

export function OutlierBadge({ score }: { score: number }) {
  const color = score >= 5 ? 'bg-purple-600' : score >= 2 ? 'bg-blue-600' : 'bg-zinc-600';
  return (
    <span className={`inline-flex items-center justify-center min-w-[44px] px-2 py-1 rounded-full text-[11px] font-bold text-white ${color}`}>
      {score.toFixed(1)}x
    </span>
  );
}
