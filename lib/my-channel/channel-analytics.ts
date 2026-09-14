/**
 * Channel Analytics — niche-based comparison and growth metrics
 *
 * Compares user's channel against 10 real competitor channels in the same niche.
 * Uses percentile benchmarks (25th, 50th, 75th) instead of generic industry averages.
 */

import { ChannelConnection, ChannelSnapshot, ChannelVideo } from '@/app/providers/channel-provider';
import { CompetitorChannel } from './competitor-discovery';

// Fallback if no competitors available
const FALLBACK_BENCHMARKS = {
  avgEngagementRate: 1.5,
  avgUploadFrequency: 2,
};

export interface ChannelComparison {
  yourMetrics: {
    engagementRate: number;
    uploadFrequencyPerMonth: number;
  };

  benchmarks: {
    niche: string;
    competitorCount: number;
    engagementRate: {
      p25: number;
      p50: number;
      p75: number;
    };
    uploadFrequency: {
      p25: number;
      p50: number;
      p75: number;
    };
  };

  comparison: {
    engagementRatio: number;
    uploadFrequencyRatio: number;
  };

  growth: {
    subscriberGrowthRate: number;
    viewGrowthRate: number;
    isGrowing: boolean;
  };
}

export interface GrowthSuggestion {
  id: string;
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  actionable: string;
  impact: string;
}

// ─── Calculate Comparison ────────────────────────────────────────────────────

export function calculateChannelComparison(
  connection: ChannelConnection,
  videos: ChannelVideo[],
  snapshots: ChannelSnapshot[],
  competitors?: CompetitorChannel[],
  niche?: string,
): ChannelComparison {
  // Your metrics
  const totalLikes = videos.reduce((sum, v) => sum + v.like_count, 0);
  const totalComments = videos.reduce((sum, v) => sum + v.comment_count, 0);
  const totalViews = videos.reduce((sum, v) => sum + v.view_count, 0);

  const engagementRate = totalViews > 0 ? ((totalLikes + totalComments) / totalViews) * 100 : 0;

  let uploadFrequencyPerMonth = 0;
  if (videos.length > 1) {
    const sortedByDate = [...videos].sort((a, b) =>
      new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
    );
    const daysSpan =
      (new Date(sortedByDate[0].published_at).getTime() -
        new Date(sortedByDate[sortedByDate.length - 1].published_at).getTime()) /
      (1000 * 60 * 60 * 24);
    uploadFrequencyPerMonth = daysSpan > 0 ? (videos.length / daysSpan) * 30 : 0;
  }

  // Benchmarks from competitors
  const benchmarkData = calculateBenchmarks(competitors, niche);

  // Growth rates
  let subscriberGrowthRate = 0;
  let viewGrowthRate = 0;
  if (snapshots.length >= 2) {
    const sortedSnapshots = [...snapshots].sort((a, b) =>
      new Date(a.snapshot_date).getTime() - new Date(b.snapshot_date).getTime()
    );
    const oldest = sortedSnapshots[0];
    const newest = sortedSnapshots[sortedSnapshots.length - 1];

    const daysDiff =
      (new Date(newest.snapshot_date).getTime() - new Date(oldest.snapshot_date).getTime()) /
      (1000 * 60 * 60 * 24);
    const monthsDiff = daysDiff / 30;

    if (monthsDiff > 0 && oldest.subscriber_count > 0) {
      const subGrowth = (newest.subscriber_count - oldest.subscriber_count) / oldest.subscriber_count;
      subscriberGrowthRate = (subGrowth / monthsDiff) * 100;
    }

    if (monthsDiff > 0 && oldest.view_count > 0) {
      const viewGrowth = (newest.view_count - oldest.view_count) / oldest.view_count;
      viewGrowthRate = (viewGrowth / monthsDiff) * 100;
    }
  }

  return {
    yourMetrics: {
      engagementRate,
      uploadFrequencyPerMonth,
    },
    benchmarks: benchmarkData,
    comparison: {
      engagementRatio:
        benchmarkData.engagementRate.p50 > 0 ? engagementRate / benchmarkData.engagementRate.p50 : 1,
      uploadFrequencyRatio:
        benchmarkData.uploadFrequency.p50 > 0
          ? uploadFrequencyPerMonth / benchmarkData.uploadFrequency.p50
          : 1,
    },
    growth: {
      subscriberGrowthRate,
      viewGrowthRate,
      isGrowing: subscriberGrowthRate > 0 && viewGrowthRate > 0,
    },
  };
}

// ─── Calculate Percentiles ──────────────────────────────────────────────────

function calculateBenchmarks(competitors?: CompetitorChannel[], niche?: string) {
  if (!competitors || competitors.length === 0) {
    return {
      niche: niche || 'General',
      competitorCount: 0,
      engagementRate: {
        p25: FALLBACK_BENCHMARKS.avgEngagementRate,
        p50: FALLBACK_BENCHMARKS.avgEngagementRate,
        p75: FALLBACK_BENCHMARKS.avgEngagementRate * 1.5,
      },
      uploadFrequency: {
        p25: FALLBACK_BENCHMARKS.avgUploadFrequency,
        p50: FALLBACK_BENCHMARKS.avgUploadFrequency,
        p75: FALLBACK_BENCHMARKS.avgUploadFrequency * 1.5,
      },
    };
  }

  const engagementRates = competitors.map((c) => c.avgEngagementRate).sort((a, b) => a - b);
  const uploadFrequencies = competitors.map((c) => c.uploadFrequency).sort((a, b) => a - b);

  return {
    niche: niche || 'Your Niche',
    competitorCount: competitors.length,
    engagementRate: {
      p25: getPercentile(engagementRates, 0.25),
      p50: getPercentile(engagementRates, 0.5),
      p75: getPercentile(engagementRates, 0.75),
    },
    uploadFrequency: {
      p25: getPercentile(uploadFrequencies, 0.25),
      p50: getPercentile(uploadFrequencies, 0.5),
      p75: getPercentile(uploadFrequencies, 0.75),
    },
  };
}

function getPercentile(sortedArray: number[], percentile: number): number {
  if (sortedArray.length === 0) return 0;
  const index = percentile * (sortedArray.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) return sortedArray[lower];

  const weight = index - lower;
  return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
}

// ─── Performance Label ───────────────────────────────────────────────────────

export function getPerformanceLabel(ratio: number): { label: string; color: string } {
  if (ratio >= 1.5) return { label: 'Excellent', color: 'text-green-500' };
  if (ratio >= 1.0) return { label: 'Great', color: 'text-emerald-500' };
  if (ratio >= 0.75) return { label: 'Good', color: 'text-blue-500' };
  if (ratio >= 0.5) return { label: 'Okay', color: 'text-yellow-500' };
  return { label: 'Needs work', color: 'text-orange-500' };
}

// ─── Growth Suggestions ─────────────────────────────────────────────────────

export function generateGrowthSuggestions(
  comparison: ChannelComparison,
  videos: ChannelVideo[],
): GrowthSuggestion[] {
  const suggestions: GrowthSuggestion[] = [];
  const { yourMetrics, benchmarks, comparison: comp, growth } = comparison;

  // Suggestion 1: Low engagement vs competitors
  if (comp.engagementRatio < 0.8 && benchmarks.competitorCount > 0) {
    suggestions.push({
      id: 'low_engagement',
      priority: 'high',
      title: '💬 Boost engagement to match competitors',
      description: `Your engagement (${yourMetrics.engagementRate.toFixed(2)}%) is below your niche median (${benchmarks.engagementRate.p50.toFixed(2)}%). Top performers: ${benchmarks.engagementRate.p75.toFixed(2)}%.`,
      actionable: 'Add engagement hooks: ask questions early, create loops, respond to comments fast. Pin top comments.',
      impact: 'Matching median could add 20-40% more reach. Top performer level could 2x your growth.',
    });
  }

  // Suggestion 2: Upload frequency lag vs competitors
  if (comp.uploadFrequencyRatio < 0.8 && benchmarks.competitorCount > 0) {
    suggestions.push({
      id: 'upload_frequency',
      priority: 'high',
      title: '🎬 Upload more to stay competitive',
      description: `You upload ${yourMetrics.uploadFrequencyPerMonth.toFixed(1)}/month vs median ${benchmarks.uploadFrequency.p50.toFixed(1)}/month. Leaders: ${benchmarks.uploadFrequency.p75.toFixed(1)}/month.`,
      actionable: 'Batch film 2-3 videos. Aim for at least median frequency to stay algorithmically competitive.',
      impact: 'Consistent uploads are a major algorithm signal. Could accelerate growth 50-100%.',
    });
  }

  // Suggestion 3: Stagnant growth
  if (!growth.isGrowing) {
    suggestions.push({
      id: 'stagnant_growth',
      priority: 'high',
      title: '📉 Break through stagnation',
      description: 'Your channel growth has stalled. Competitors likely pulling ahead.',
      actionable: 'Analyze your top 3 videos. What topic/format? Test a trending angle in your niche or collaboration.',
      impact: 'One viral video or format shift can restart growth immediately.',
    });
  }

  // Suggestion 4: Engagement above median
  if (comp.engagementRatio >= 1.2 && benchmarks.competitorCount > 0) {
    suggestions.push({
      id: 'high_engagement',
      priority: 'low',
      title: '🏆 Leverage your engagement advantage',
      description: `Your engagement (${yourMetrics.engagementRate.toFixed(2)}%) beats ${benchmarks.engagementRate.p75.toFixed(2)}% of competitors.`,
      actionable: 'Convert this loyalty: ask for subs in CTAs, launch merchandise, create community posts. Build on it.',
      impact: 'Engaged audiences = loyal subscribers and unlock monetization faster.',
    });
  }

  // Suggestion 5: Uploading faster than competitors
  if (comp.uploadFrequencyRatio >= 1.2 && benchmarks.competitorCount > 0) {
    suggestions.push({
      id: 'high_frequency',
      priority: 'low',
      title: '⚡ You have consistency advantage',
      description: `You upload ${yourMetrics.uploadFrequencyPerMonth.toFixed(1)}/month vs ${benchmarks.uploadFrequency.p50.toFixed(1)}/month median.`,
      actionable: 'Maintain momentum. Test longer videos or series formats. You should outpace competitors.',
      impact: 'Consistency = loyalty + algorithm love. Growth should accelerate.',
    });
  }

  // Suggestion 6: Inconsistent performance
  if (videos.length >= 5) {
    const viewCounts = videos.map((v) => v.view_count);
    const maxViews = Math.max(...viewCounts);
    const minViews = Math.min(...viewCounts);
    const variance = maxViews / Math.max(minViews, 1);

    if (variance > 5) {
      suggestions.push({
        id: 'inconsistent_performance',
        priority: 'medium',
        title: '🎯 Find and repeat your winning formula',
        description: `Your videos vary wildly (best: ${maxViews.toLocaleString()}, worst: ${minViews.toLocaleString()}). Competitors are consistent.`,
        actionable: 'Study your top 3. Same topic, length, hook, thumbnail style? Build repeatable system.',
        impact: 'Consistency ranks higher and audiences can predict what they get.',
      });
    }
  }

  return suggestions.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}
