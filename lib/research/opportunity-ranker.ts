/**
 * Rank verified search queries using YouTube result-set metrics.
 *
 * Score = Volume×0.40 + (100−Competition)×0.35 + Engagement×0.25
 *
 * Volume prefers Google Trends YouTube relative interest (0–100) when present,
 * otherwise matching-video views + autocomplete rank.
 * Google Ads Keyword Planner is paid and is not used.
 * Competition / engagement come from videos whose titles contain the query.
 * Terms themselves still come only from suggestion providers.
 */

import type { RealOpportunity, SearchTerm, YouTubeChannel, YouTubeVideo } from '@/lib/types/research';
import { SEARCH_RANK_WEIGHTS, normalizeScore } from '@/lib/config/research';
import { calculateEngagementRate, safeParseInt } from '@/lib/youtube/utils';

function clamp100(n: number) {
  return normalizeScore(n, 0, 100);
}

function competitionLevel(score: number): 'low' | 'moderate' | 'high' {
  if (score < 34) return 'low';
  if (score < 67) return 'moderate';
  return 'high';
}

function titleMatchesQuery(title: string, query: string): boolean {
  const t = title.toLowerCase();
  const q = query.toLowerCase().trim();
  if (q.length < 2) return false;
  return t.includes(q);
}

function logScale(value: number, cap: number): number {
  if (value <= 0) return 0;
  return (Math.log10(value + 1) / Math.log10(cap + 1)) * 100;
}

export function rankSearchOpportunities(
  terms: SearchTerm[],
  videos: YouTubeVideo[],
  channels: YouTubeChannel[],
): RealOpportunity[] {
  const subByChannel = new Map<string, number>();
  for (const ch of channels) {
    subByChannel.set(ch.channelId, safeParseInt(ch.statistics.subscriberCount));
  }

  const scored = terms.map((term, index) => {
    const matches = videos.filter(v => titleMatchesQuery(v.title, term.term));
    const views = matches.map(v => safeParseInt(v.statistics.viewCount));
    const totalMatchViews = views.reduce((s, n) => s + n, 0);

    const engagementRates = matches.map(v =>
      calculateEngagementRate(
        safeParseInt(v.statistics.viewCount),
        safeParseInt(v.statistics.likeCount),
        safeParseInt(v.statistics.commentCount),
      ),
    );
    const avgEngagementRate = engagementRates.length
      ? engagementRates.reduce((s, n) => s + n, 0) / engagementRates.length
      : 0;

    const avgSubs = matches.length
      ? matches.reduce((s, v) => s + (subByChannel.get(v.channelId) || 0), 0) / matches.length
      : 0;

    const suggestRankScore = clamp100(100 - index * 4);
    const viewsScore = clamp100(logScale(totalMatchViews, 10_000_000));
    const plannerVolume = term.volume != null && term.volume >= 0 ? clamp100(term.volume) : null;
    const volumeScore = plannerVolume != null
      ? clamp100(plannerVolume * 0.75 + (matches.length ? viewsScore : suggestRankScore) * 0.25)
      : matches.length
        ? clamp100(viewsScore * 0.8 + suggestRankScore * 0.2)
        : clamp100(suggestRankScore * 0.5);

    const supplyScore = clamp100((matches.length / 12) * 100);
    const authorityScore = clamp100(logScale(avgSubs, 5_000_000));
    const competitionScore = matches.length
      ? clamp100(supplyScore * 0.65 + authorityScore * 0.35)
      : 0;

    const engagementScore = clamp100((avgEngagementRate / 5) * 100);

    const opportunityScore = clamp100(
      volumeScore * SEARCH_RANK_WEIGHTS.volume
      + (100 - competitionScore) * SEARCH_RANK_WEIGHTS.competition
      + engagementScore * SEARCH_RANK_WEIGHTS.engagement,
    );

    return {
      rank: 0,
      searchQuery: term.term,
      source: term.source,
      sourceId: term.sourceId,
      retrievedAt: term.retrievedAt,
      opportunityScore,
      volumeScore,
      competitionScore,
      engagementScore,
      competitionLevel: competitionLevel(competitionScore),
      videoMatches: matches.length,
      totalMatchViews,
      avgEngagementRate: Math.round(avgEngagementRate * 100) / 100,
      scoreBreakdown: {
        volume: volumeScore,
        competition: competitionScore,
        engagement: engagementScore,
        formula: `Volume×${SEARCH_RANK_WEIGHTS.volume} + (100−Competition)×${SEARCH_RANK_WEIGHTS.competition} + Engagement×${SEARCH_RANK_WEIGHTS.engagement}`,
      },
    } satisfies RealOpportunity;
  });

  scored.sort((a, b) => {
    if (b.opportunityScore !== a.opportunityScore) return b.opportunityScore - a.opportunityScore;
    if (b.volumeScore !== a.volumeScore) return b.volumeScore - a.volumeScore;
    return a.searchQuery.localeCompare(b.searchQuery);
  });

  return scored.map((opp, i) => ({ ...opp, rank: i + 1 }));
}
