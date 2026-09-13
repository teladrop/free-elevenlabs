'use client';

import { useState } from 'react';
import type { ResearchSession } from '@/lib/types/research';
import { DataBadge } from './data-badge';
import { Search, Check, Copy } from 'lucide-react';
import { SEARCH_SOURCE_LABEL } from '@/lib/types/research';
import { RankScore } from './rank-score';

interface TitlesTabProps { session: ResearchSession; }

export function TitlesTab({ session }: TitlesTabProps) {
  const si = session.searchIntelligence;
  const [copied, setCopied] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  if (!si || si.titles.length === 0) {
    return (
      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-16 text-center">
        <Search className="w-10 h-10 mx-auto text-[hsl(var(--muted-foreground))] mb-3" />
        <p className="text-sm text-[hsl(var(--muted-foreground))]">No verified related searches available.</p>
        <p className="text-xs text-[hsl(var(--muted-foreground))]/60 mt-1">
          Suggestion providers returned no real search queries for this topic
        </p>
      </div>
    );
  }

  const all = si.titles;

  const copy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopied(idx);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-5 py-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-sm font-semibold text-[hsl(var(--foreground))]">
              {all.length} Verified Searches
            </p>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
              Ranked with the same score as Opportunities — Volume × Competition × Engagement
            </p>
          </div>
          <DataBadge source="calculated" />
        </div>
      </div>

      <div className="space-y-2">
        {all.map((t, i) => {
          const isOpen = expanded === i;
          return (
            <div
              key={`${t.source}-${t.rawQuery}-${i}`}
              className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] transition-colors"
            >
              <div className="flex items-start gap-3 p-4">
                <span className="shrink-0 w-6 h-6 rounded-full bg-[hsl(var(--surface-elevated))] text-[hsl(var(--muted-foreground))] text-xs font-bold flex items-center justify-center mt-0.5">
                  {t.rank}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[hsl(var(--foreground))] leading-snug">
                    {t.rawQuery}
                  </p>
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    <span className="text-[11px] text-[hsl(var(--muted-foreground))]">
                      {SEARCH_SOURCE_LABEL[t.source]}
                    </span>
                    <span className="text-[11px] text-[hsl(var(--muted-foreground))]">
                      Vol {t.volumeScore} · Comp {t.competitionScore} · Eng {t.engagementScore}
                    </span>
                    <button
                      onClick={() => setExpanded(isOpen ? null : i)}
                      className="text-[11px] text-[hsl(var(--primary))] hover:underline"
                    >
                      {isOpen ? 'Hide' : 'Details'}
                    </button>
                  </div>
                </div>
                <RankScore score={t.opportunityScore} />
                <button
                  onClick={() => copy(t.rawQuery, i)}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    copied === i
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      : 'bg-[hsl(var(--surface-elevated))] text-[hsl(var(--muted-foreground))] border-[hsl(var(--border))] hover:text-[hsl(var(--foreground))]'
                  }`}
                >
                  {copied === i ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
                </button>
              </div>

              {isOpen && (
                <div className="border-t border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] px-4 py-4 space-y-3 rounded-b-xl">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2 py-2">
                      <div className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase">Volume</div>
                      <div className="text-sm font-bold">{t.volumeScore}</div>
                    </div>
                    <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2 py-2">
                      <div className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase">Competition</div>
                      <div className="text-sm font-bold">{t.competitionScore}</div>
                    </div>
                    <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2 py-2">
                      <div className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase">Engagement</div>
                      <div className="text-sm font-bold">{t.engagementScore}</div>
                    </div>
                  </div>
                  <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg px-3 py-2.5">
                    <div className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-widest mb-1">Exact query</div>
                    <p className="text-xs font-mono text-[hsl(var(--foreground))]">"{t.rawQuery}"</p>
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1">
                      Source: {SEARCH_SOURCE_LABEL[t.source]} · seed “{t.sourceId}”
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <DataBadge source="calculated" />
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
                      Score uses Google Trends YouTube interest when available, plus YouTube competition and engagement.
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
