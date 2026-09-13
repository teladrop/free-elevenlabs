export function rankScoreColor(s: number) {
  if (s >= 70) return 'text-emerald-400 bg-emerald-500/12 border-emerald-500/25';
  if (s >= 50) return 'text-amber-400 bg-amber-500/12 border-amber-500/25';
  return 'text-[hsl(var(--muted-foreground))] bg-[hsl(var(--surface-elevated))] border-[hsl(var(--border))]';
}

export function RankScore({ score }: { score: number }) {
  return (
    <span
      className={`shrink-0 min-w-[2.5rem] h-9 px-2 rounded-lg border flex flex-col items-center justify-center leading-none ${rankScoreColor(score)}`}
      title="Opportunity rank score"
    >
      <span className="text-base font-extrabold tabular-nums">{score}</span>
      <span className="text-[8px] font-semibold uppercase tracking-wider opacity-70 mt-0.5">score</span>
    </span>
  );
}
