'use client';

import type { DataSource } from '@/lib/types/research';

interface DataBadgeProps {
  source: DataSource;
  className?: string;
}

const BADGE_CONFIG: Record<DataSource, {
  label: string;
  dot: string;
  pill: string;
  description: string;
}> = {
  'youtube-data': {
    label: 'YouTube Data',
    dot: 'bg-red-400',
    pill: 'bg-red-500/10 text-red-400 border-red-500/20',
    description: 'Real data from YouTube API',
  },
  'calculated': {
    label: 'Calculated',
    dot: 'bg-blue-400',
    pill: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    description: 'Metrics calculated from real data',
  },
  'ai-analysis': {
    label: 'AI Analysis',
    dot: 'bg-purple-400',
    pill: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    description: 'AI pattern interpretation',
  },
  'ai-generated': {
    label: 'AI Generated',
    dot: 'bg-emerald-400',
    pill: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    description: 'AI-created content ideas',
  },
};

export function DataBadge({ source, className = '' }: DataBadgeProps) {
  const c = BADGE_CONFIG[source];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${c.pill} ${className}`}
      title={c.description}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}

export function DataSourceLegend() {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span className="text-xs text-[hsl(var(--muted-foreground))] font-medium">Source:</span>
      {(Object.keys(BADGE_CONFIG) as DataSource[]).map(source => (
        <DataBadge key={source} source={source} />
      ))}
    </div>
  );
}
