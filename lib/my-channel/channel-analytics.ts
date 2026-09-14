/**
 * Channel Analytics — comparison and growth metrics
 *
 * YouTube benchmark data sourced from public statistics and industry reports.
 * These are approximate ranges for creator channels (not mega-creators).
 */

import { ChannelConnection, ChannelSnapshot, ChannelVideo } from '@/app/providers/channel-provider';

// Industry benchmarks for creator channels (100K - 1M subs)
const BENCHMARKS = {
  // Engagement rates (per 1000 views)
  avgLikesPerKViews:     150,  // 0.015% avg like rate
  avgCommentsPerKViews:  30,   // 0.003% avg comment rate
  avgViewsPerVideo:      45000, // typical video view count
  
  // Growth rates (monthly)
  monthlySubscriberGrowth: 0.08, // 8% monthly growth
  monthlyViewGrowth:      0.12,  // 12% monthly growth
  
  // Upload frequency
  avgUploadsPerMonth:    4, // 1 per week
};

export interface ChannelComparison {
  // Your channel metrics
  yourMetrics: {
    subscriberCount: number;
    totalViews: number;
    avgViewsPerVideo: number;
    avgLikesPerVideo: number;
    avgCommentsPerVideo: number;
    engagementRate: number; // (likes + comments) / views * 100
    uploadFrequencyPerMonth: number;
  };
  
  // Benchmark comparison
  benchmarks: {
    avgViewsPerVideo: number;
    avgEngagementRate: number;
    avgUploadFrequency: number;
  };
  
  // Performance vs benchmarks
  comparison: {
    viewsPerVideoRatio: number;      // your / benchmark
    engagementRatio: number;          // your / benchmark
    uploadFrequencyRatio: number;     // your / benchmark
  };
  
  // Growth trend
  growth: {
    subscriberGrowthRate: number; // % per month
    viewGrowthRate: number;       // % per month
    isGrowing: boolean;
  };
}

export function calculateChannelComparison(
  connection: ChannelConnection,
  videos: ChannelVideo[],
  snapshots: ChannelSnapshot[],
): ChannelComparison {
  // Calculate your metrics
  const totalLikes = videos.reduce((sum, v) => sum + v.like_count, 0);
  const totalComments = videos.reduce((sum, v) => sum + v.comment_count, 0);
  const totalViews = videos.reduce((sum, v) => sum + v.view_count, 0);
  
  const avgViewsPerVideo = videos.length > 0 ? totalViews / videos.length : 0;
  const avgLikesPerVideo = videos.length > 0 ? totalLikes / videos.length : 0;
  const avgCommentsPerVideo = videos.length > 0 ? totalComments / videos.length : 0;
  
  const engagementRate = totalViews > 0
    ? ((totalLikes + totalComments) / totalViews) * 100
    : 0;

  // Calculate upload frequency (videos per month, based on published dates)
  let uploadFrequencyPerMonth = 0;
  if (videos.length > 1) {
    const sortedByDate = [...videos].sort((a, b) =>
      new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
    );
    const newestDate = new Date(sortedByDate[0].published_at);
    const oldestDate = new Date(sortedByDate[sortedByDate.length - 1].published_at);
    const daysSpan = (newestDate.getTime() - oldestDate.getTime()) / (1000 * 60 * 60 * 24);
    const monthsSpan = daysSpan / 30;
    uploadFrequencyPerMonth = monthsSpan > 0 ? videos.length / monthsSpan : 0;
  }

  // Calculate growth rates from snapshots
  let subscriberGrowthRate = 0;
  let viewGrowthRate = 0;
  if (snapshots.length >= 2) {
    const sortedSnapshots = [...snapshots].sort((a, b) =>
      new Date(a.snapshot_date).getTime() - new Date(b.snapshot_date).getTime()
    );
    const oldest = sortedSnapshots[0];
    const newest = sortedSnapshots[sortedSnapshots.length - 1];
    
    const daysDiff = (new Date(newest.snapshot_date).getTime() - new Date(oldest.snapshot_date).getTime()) / (1000 * 60 * 60 * 24);
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

  // Benchmark comparison
  const avgEngagementRate = (BENCHMARKS.avgLikesPerKViews + BENCHMARKS.avgCommentsPerKViews) / 10;
  
  return {
    yourMetrics: {
      subscriberCount: connection.subscriber_count,
      totalViews: connection.view_count,
      avgViewsPerVideo,
      avgLikesPerVideo,
      avgCommentsPerVideo,
      engagementRate,
      uploadFrequencyPerMonth,
    },
    benchmarks: {
      avgViewsPerVideo: BENCHMARKS.avgViewsPerVideo,
      avgEngagementRate,
      avgUploadFrequency: BENCHMARKS.avgUploadsPerMonth,
    },
    comparison: {
      viewsPerVideoRatio: avgViewsPerVideo / BENCHMARKS.avgViewsPerVideo,
      engagementRatio: engagementRate / avgEngagementRate,
      uploadFrequencyRatio: uploadFrequencyPerMonth / BENCHMARKS.avgUploadsPerMonth,
    },
    growth: {
      subscriberGrowthRate,
      viewGrowthRate,
      isGrowing: subscriberGrowthRate > 0 && viewGrowthRate > 0,
    },
  };
}

export function getPerformanceLabel(ratio: number): { label: string; color: string } {
  if (ratio >= 1.5) return { label: 'Excellent', color: 'text-green-500' };
  if (ratio >= 1.0) return { label: 'Great', color: 'text-emerald-500' };
  if (ratio >= 0.75) return { label: 'Good', color: 'text-blue-500' };
  if (ratio >= 0.5) return { label: 'Okay', color: 'text-yellow-500' };
  return { label: 'Needs work', color: 'text-orange-500' };
}

// ─── Growth Suggestions ───────────────────────────────────────────────────────

export interface GrowthSuggestion {
  id: string;
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  actionable: string; // specific next step
  impact: string; // expected outcome
}

export function generateGrowthSuggestions(
  comparison: ChannelComparison,
  videos: ChannelVideo[],
): GrowthSuggestion[] {
  const suggestions: GrowthSuggestion[] = [];

  const { yourMetrics, benchmarks, comparison: comp, growth } = comparison;

  // Suggestion 1: Low views per video
  if (comp.viewsPerVideoRatio < 0.75) {
    suggestions.push({
      id: 'low_views',
      priority: 'high',
      title: '📊 Improve average views per video',
      description: `Your videos average ${yourMetrics.avgViewsPerVideo.toLocaleString()} views vs ${benchmarks.avgViewsPerVideo.toLocaleString()} benchmark. This is your biggest growth lever.`,
      actionable: 'Analyze top-performing videos for patterns: thumbnails, titles, hooks, and topics. A/B test new thumbnail designs and headlines.',
      impact: 'Increasing views per video by 50% could add 1K-2K new subscribers/month',
    });
  }

  // Suggestion 2: Low engagement
  if (comp.engagementRatio < 0.75) {
    suggestions.push({
      id: 'low_engagement',
      priority: 'high',
      title: '💬 Boost engagement rate',
      description: `Viewers engage at ${yourMetrics.engagementRate.toFixed(2)}% vs ${benchmarks.avgEngagementRate.toFixed(2)}% benchmark. Encourage comments and likes early in videos.`,
      actionable: 'Add engagement hooks: ask questions, create loops, add CTAs at 20-40% mark. Pin top comments to encourage discussion.',
      impact: 'Higher engagement signals YouTube to recommend your content more',
    });
  }

  // Suggestion 3: Upload frequency
  if (comp.uploadFrequencyRatio < 0.8 && yourMetrics.uploadFrequencyPerMonth > 0) {
    suggestions.push({
      id: 'upload_frequency',
      priority: 'high',
      title: '🎬 Increase upload frequency',
      description: `You upload ${yourMetrics.uploadFrequencyPerMonth.toFixed(1)}/month vs ${benchmarks.avgUploadFrequency}/month benchmark. Consistency signals YouTube.`,
      actionable: 'Plan a content calendar. Start with 1 video/week if possible, or every 10 days minimum.',
      impact: 'More frequent uploads = more viewer touchpoints and YouTube algorithmic weight',
    });
  }

  // Suggestion 4: Stagnant growth
  if (!growth.isGrowing) {
    suggestions.push({
      id: 'stagnant_growth',
      priority: 'medium',
      title: '📉 Reverse stagnation',
      description: `Your channel isn't growing. This could be content saturation, audience fatigue, or algorithm changes.`,
      actionable: 'Survey your audience: poll in community tab or Discord. What content do they want? Test new formats or topics.',
      impact: 'Fresh angles and audience input can reinvigorate growth',
    });
  }

  // Suggestion 5: Slow subscriber growth despite high views
  if (
    yourMetrics.totalViews > 0 &&
    growth.subscriberGrowthRate < 2 &&
    comp.viewsPerVideoRatio > 0.8
  ) {
    suggestions.push({
      id: 'low_sub_conversion',
      priority: 'medium',
      title: '👥 Convert viewers to subscribers',
      description: `You're getting views but not converting to subscribers. Your videos might not be building a loyal audience.`,
      actionable: 'Improve channel branding, intro, and CTA. Make a consistent outro that asks for subscribes. Use YouTube cards mid-video.',
      impact: 'Better sub conversion = compounding audience growth',
    });
  }

  // Suggestion 6: Video variety
  if (yourMetrics.uploadFrequencyPerMonth > 0 && videos.length > 5) {
    const viewRange = Math.max(...videos.map(v => v.view_count)) - Math.min(...videos.map(v => v.view_count));
    const avgViews = yourMetrics.avgViewsPerVideo;
    // High variance = inconsistent performance
    if (viewRange > avgViews * 2) {
      suggestions.push({
        id: 'inconsistent_performance',
        priority: 'medium',
        title: '🎯 Standardize successful formats',
        description: `Your video performance is highly inconsistent. Some get 10x more views than others.`,
        actionable: 'Identify your 3 top videos. What do they have in common? Double down on that format/topic.',
        impact: 'Consistency makes your channel predictable to both viewers and the algorithm',
      });
    }
  }

  // Suggestion 7: Leverage growth window
  if (growth.isGrowing && growth.subscriberGrowthRate > 5) {
    suggestions.push({
      id: 'growth_window',
      priority: 'high',
      title: '🚀 Capitalize on momentum',
      description: `Great news! Your channel is growing at ${growth.subscriberGrowthRate.toFixed(1)}%/month. Strike while the iron is hot.`,
      actionable: 'Increase output or collaborate. Launch a series or channel event. This is your window to accelerate.',
      impact: 'Riding momentum can turn 5% growth into 20%+ growth',
    });
  }

  return suggestions.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}
