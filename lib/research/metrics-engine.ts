/**
 * Metrics Engine
 * 
 * Calculates all metrics from REAL YouTube data
 * NO FABRICATION - every number comes from actual data
 */

import type {
  YouTubeVideo,
  YouTubeChannel,
  VideoMetrics,
  BreakoutVideo,
  ChannelMetrics,
  SearchSignal,
  TopicSaturation,
  MomentumIndex,
  CompetitionScore,
  DifficultyScore,
} from '@/lib/types/research';

import {
  BREAKOUT_THRESHOLDS,
  SATURATION_THRESHOLDS,
  MOMENTUM_THRESHOLDS,
  COMPETITION_THRESHOLDS,
  DIFFICULTY_THRESHOLDS,
  COMPETITION_WEIGHTS,
  DIFFICULTY_WEIGHTS,
  RESEARCH_PARAMS,
  normalizeScore,
  getBreakoutLabel,
  getSaturationLevel,
  getMomentumTrend,
  getCompetitionLevel,
  getDifficultyLevel,
} from '@/lib/config/research';

import {
  safeParseInt,
  ageInDays,
  viewsPerDay,
  calculateEngagementRate,
  parseDuration,
  median,
  average,
  isRecent,
} from '@/lib/youtube/utils';

// ============================================================================
// VIDEO METRICS (From real YouTube data)
// ============================================================================

/**
 * Calculate metrics for a single video
 */
export function calculateVideoMetrics(
  video: YouTubeVideo,
  channelSubscribers: number
): VideoMetrics {
  const views = safeParseInt(video.statistics.viewCount);
  const likes = safeParseInt(video.statistics.likeCount);
  const comments = safeParseInt(video.statistics.commentCount);
  
  const publishedDate = new Date(video.publishedAt);
  const age = ageInDays(video.publishedAt);
  const vpd = viewsPerDay(views, video.publishedAt);
  const engagement = calculateEngagementRate(views, likes, comments);
  const duration = parseDuration(video.contentDetails.duration);
  
  const viewsToSubs = channelSubscribers > 0 ? views / channelSubscribers : 0;
  
  return {
    videoId: video.videoId,
    views,
    likes,
    comments,
    engagementRate: Math.round(engagement * 100) / 100,
    publishedAt: publishedDate,
    ageInDays: age,
    viewsPerDay: vpd,
    channelSubscribers,
    viewsToSubsRatio: Math.round(viewsToSubs * 100) / 100,
    durationSeconds: duration,
    source: 'calculated',
    calculatedAt: new Date().toISOString(),
  };
}

/**
 * Calculate metrics for all videos
 */
export function calculateAllVideoMetrics(
  videos: YouTubeVideo[],
  channelMap: Map<string, number>
): VideoMetrics[] {
  return videos.map(video => {
    const subs = channelMap.get(video.channelId) || 0;
    return calculateVideoMetrics(video, subs);
  });
}

// ============================================================================
// BREAKOUT DETECTION (From real performance data)
// ============================================================================

/**
 * Identify breakout videos
 * A breakout is when views significantly exceed channel subscriber baseline
 */
export function identifyBreakoutVideos(
  videos: YouTubeVideo[],
  channelMap: Map<string, number>
): BreakoutVideo[] {
  const breakouts: BreakoutVideo[] = [];
  
  for (const video of videos) {
    const views = safeParseInt(video.statistics.viewCount);
    const subscribers = channelMap.get(video.channelId) || 0;
    
    // Skip if no subscriber data
    if (subscribers === 0) continue;
    
    // Skip very low view counts
    if (views < RESEARCH_PARAMS.minViews) continue;
    
    const ratio = views / subscribers;
    const label = getBreakoutLabel(ratio);
    
    // Only include if strong or better
    if (label === 'below' || label === 'normal') continue;
    
    const metrics = calculateVideoMetrics(video, subscribers);
    
    let reasoning = '';
    if (label === 'major-breakout') {
      reasoning = `Exceptional viral performance: ${ratio.toFixed(1)}x channel subscriber count. Video reached far beyond existing audience.`;
    } else if (label === 'breakout') {
      reasoning = `Strong breakout: ${ratio.toFixed(1)}x channel subscriber count. Significant audience expansion beyond existing base.`;
    } else if (label === 'strong') {
      reasoning = `Solid performance: ${ratio.toFixed(1)}x channel subscriber count. Video exceeded typical subscriber conversion.`;
    }
    
    breakouts.push({
      video,
      metrics,
      breakoutRatio: Math.round(ratio * 10) / 10,
      label,
      reasoning,
      source: 'calculated',
      calculatedAt: new Date().toISOString(),
    });
  }
  
  // Sort by ratio (highest first)
  return breakouts.sort((a, b) => b.breakoutRatio - a.breakoutRatio);
}

// ============================================================================
// CHANNEL METRICS (From real channel data)
// ============================================================================

/**
 * Calculate comprehensive metrics for a channel
 */
export function calculateChannelMetrics(
  channel: YouTubeChannel,
  channelVideos: YouTubeVideo[]
): ChannelMetrics {
  const subscribers = safeParseInt(channel.statistics.subscriberCount);
  const totalViews = safeParseInt(channel.statistics.viewCount);
  const videoCount = safeParseInt(channel.statistics.videoCount);
  
  if (channelVideos.length === 0) {
    return {
      channelId: channel.channelId,
      subscribers,
      totalViews,
      videoCount,
      relevantVideos: 0,
      avgViewsPerVideo: 0,
      medianViewsPerVideo: 0,
      bestVideo: channelVideos[0],
      recentUploads: 0,
      uploadFrequency: 0,
      shortsShare: 0,
      avgEngagementRate: 0,
      source: 'calculated',
      calculatedAt: new Date().toISOString(),
    };
  }
  
  // Calculate view statistics
  const views = channelVideos.map(v => safeParseInt(v.statistics.viewCount));
  const avgViews = Math.round(average(views));
  const medianViews = Math.round(median(views));
  
  // Find best performing video
  const bestVideo = channelVideos.reduce((best, current) => {
    const bestViews = safeParseInt(best.statistics.viewCount);
    const currentViews = safeParseInt(current.statistics.viewCount);
    return currentViews > bestViews ? current : best;
  });
  
  // Calculate recent uploads (last 30 days)
  const recentUploads = channelVideos.filter(v => 
    isRecent(v.publishedAt, RESEARCH_PARAMS.recentDays)
  ).length;
  
  // Calculate upload frequency (videos per month)
  const videoAges = channelVideos.map(v => ageInDays(v.publishedAt));
  const oldestAge = Math.max(...videoAges, 1);
  const uploadFrequency = (channelVideos.length / oldestAge) * 30;
  
  // Calculate average engagement rate
  const engagementRates = channelVideos.map(v => {
    const views = safeParseInt(v.statistics.viewCount);
    const likes = safeParseInt(v.statistics.likeCount);
    const comments = safeParseInt(v.statistics.commentCount);
    return calculateEngagementRate(views, likes, comments);
  });
  const avgEngagement = average(engagementRates);

  const timed = channelVideos
    .map((v) => parseDuration(v.contentDetails?.duration || ''))
    .filter((d) => d > 0);
  const shortsShare = timed.length
    ? timed.filter((d) => d <= 60).length / timed.length
    : 0;

  return {
    channelId: channel.channelId,
    subscribers,
    totalViews,
    videoCount,
    relevantVideos: channelVideos.length,
    avgViewsPerVideo: avgViews,
    medianViewsPerVideo: medianViews,
    bestVideo,
    recentUploads,
    uploadFrequency: Math.round(uploadFrequency * 10) / 10,
    shortsShare: Math.round(shortsShare * 100) / 100,
    avgEngagementRate: Math.round(avgEngagement * 100) / 100,
    source: 'calculated',
    calculatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// SEARCH SIGNALS (From real video patterns)
// ============================================================================

/**
 * Extract search signals from video titles and descriptions
 * These are OBSERVED patterns, not fabricated keywords
 */
export function extractSearchSignals(
  _videos: YouTubeVideo[],
  _minOccurrences: number = 3
): SearchSignal[] {
  // Title/description n-grams are not search terms. Never convert video text into keywords.
  return [];
}

// ============================================================================
// TOPIC SATURATION (From real content volume)
// ============================================================================

/**
 * Calculate topic saturation from real content data
 */
export function calculateTopicSaturation(
  videos: YouTubeVideo[],
  channels: YouTubeChannel[]
): TopicSaturation {
  const totalVideos = videos.length;
  const uniqueChannels = new Set(videos.map(v => v.channelId)).size;
  
  // Recent videos (last 30 days)
  const recentVideos = videos.filter(v => 
    isRecent(v.publishedAt, RESEARCH_PARAMS.recentDays)
  ).length;
  
  // Calculate channel dominance (top 3 channels by views)
  const channelViews = new Map<string, number>();
  for (const video of videos) {
    const views = safeParseInt(video.statistics.viewCount);
    const existing = channelViews.get(video.channelId) || 0;
    channelViews.set(video.channelId, existing + views);
  }
  
  const sortedChannels = Array.from(channelViews.entries())
    .sort((a, b) => b[1] - a[1]);
  
  const totalViews = Array.from(channelViews.values()).reduce((sum, v) => sum + v, 0);
  const top3Views = sortedChannels.slice(0, 3).reduce((sum, [_, views]) => sum + views, 0);
  const topChannelDominance = totalViews > 0 ? (top3Views / totalViews) * 100 : 0;
  
  // Calculate content age
  const ages = videos.map(v => ageInDays(v.publishedAt));
  const medianAge = median(ages);
  const outdatedContent = videos.filter(v => ageInDays(v.publishedAt) > 730).length; // 2+ years
  
  // Calculate saturation score (0-100)
  let saturationScore = 0;
  
  // Factor 1: Total video count (0-30 points)
  if (totalVideos > 100) saturationScore += 30;
  else if (totalVideos > 50) saturationScore += 25;
  else if (totalVideos > 25) saturationScore += 15;
  else if (totalVideos > 10) saturationScore += 8;
  else saturationScore += 3;
  
  // Factor 2: Recent activity (0-25 points)
  const recentRatio = totalVideos > 0 ? recentVideos / totalVideos : 0;
  saturationScore += recentRatio * 25;
  
  // Factor 3: Channel concentration (0-25 points)
  // High concentration = high saturation
  saturationScore += (topChannelDominance / 100) * 25;
  
  // Factor 4: Content freshness (0-20 points)
  // Older median age = lower saturation (more opportunity)
  if (medianAge < 90) saturationScore += 20; // Very fresh
  else if (medianAge < 180) saturationScore += 15;
  else if (medianAge < 365) saturationScore += 10;
  else if (medianAge < 730) saturationScore += 5;
  else saturationScore += 0; // Outdated = opportunity
  
  saturationScore = normalizeScore(saturationScore);
  const level = getSaturationLevel(saturationScore);
  
  // Generate reasoning
  let reasoning = '';
  if (level === 'low') {
    reasoning = `Low saturation (${totalVideos} videos, ${uniqueChannels} channels). ${medianAge > 365 ? 'Most content is outdated, creating opportunity for fresh perspectives.' : 'Limited coverage provides entry opportunities.'}`;
  } else if (level === 'moderate') {
    reasoning = `Moderate saturation (${totalVideos} videos, ${uniqueChannels} channels). ${topChannelDominance > 60 ? 'Market dominated by top channels but room for differentiation.' : 'Balanced competition with opportunity for unique angles.'}`;
  } else {
    reasoning = `High saturation (${totalVideos} videos, ${uniqueChannels} channels, ${recentVideos} recent). ${topChannelDominance > 70 ? 'Top channels dominate - requires exceptional differentiation.' : 'Crowded market requires strong unique value proposition.'}`;
  }
  
  return {
    totalVideos,
    recentVideos,
    uniqueChannels,
    topChannelDominance: Math.round(topChannelDominance),
    medianAgeInDays: Math.round(medianAge),
    outdatedContent,
    saturationScore,
    level,
    source: 'calculated',
    reasoning,
  };
}

// ============================================================================
// MOMENTUM INDEX (From real temporal patterns)
// ============================================================================

/**
 * Calculate momentum from recent vs historical performance
 */
export function calculateMomentumIndex(videos: YouTubeVideo[]): MomentumIndex {
  if (videos.length === 0) {
    return {
      recentAvgViews: 0,
      historicalAvgViews: 0,
      recentUploads: 0,
      historicalUploads: 0,
      momentumScore: 50,
      trend: 'stable',
      source: 'calculated',
      reasoning: 'No videos to analyze',
    };
  }
  
  // Split videos into recent (0-30 days) and historical (30-180 days)
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - RESEARCH_PARAMS.recentDays * 24 * 60 * 60 * 1000);
  const sixMonthsAgo = new Date(now.getTime() - RESEARCH_PARAMS.historicalDays * 24 * 60 * 60 * 1000);
  
  const recentVideos = videos.filter(v => new Date(v.publishedAt) >= thirtyDaysAgo);
  const historicalVideos = videos.filter(v => {
    const date = new Date(v.publishedAt);
    return date < thirtyDaysAgo && date >= sixMonthsAgo;
  });
  
  // Calculate average views
  const recentViews = recentVideos.map(v => safeParseInt(v.statistics.viewCount));
  const historicalViews = historicalVideos.map(v => safeParseInt(v.statistics.viewCount));
  
  const recentAvgViews = recentViews.length > 0 ? Math.round(average(recentViews)) : 0;
  const historicalAvgViews = historicalViews.length > 0 ? Math.round(average(historicalViews)) : 0;
  
  const recentUploads = recentVideos.length;
  const historicalUploads = historicalVideos.length;
  
  // Calculate momentum score (50 = stable baseline)
  let momentumScore = 50;
  
  // Factor 1: View performance (0-50 points added/subtracted)
  if (historicalAvgViews > 0) {
    const viewRatio = recentAvgViews / historicalAvgViews;
    if (viewRatio > 2.0) momentumScore += 30; // Surging
    else if (viewRatio > 1.5) momentumScore += 20; // Growing strongly
    else if (viewRatio > 1.2) momentumScore += 10; // Growing
    else if (viewRatio > 0.8) momentumScore += 0; // Stable
    else if (viewRatio > 0.5) momentumScore -= 15; // Declining
    else momentumScore -= 30; // Declining sharply
  } else if (recentAvgViews > 0) {
    momentumScore += 25; // New topic with activity
  }
  
  // Factor 2: Upload activity (0-20 points added/subtracted)
  const uploadRatio = historicalUploads > 0 ? recentUploads / (historicalUploads / 5) : 1; // Normalize to monthly
  if (uploadRatio > 1.5) momentumScore += 15;
  else if (uploadRatio > 1.0) momentumScore += 5;
  else if (uploadRatio < 0.5) momentumScore -= 10;
  else if (uploadRatio < 0.75) momentumScore -= 5;
  
  momentumScore = normalizeScore(momentumScore);
  const trend = getMomentumTrend(momentumScore);
  
  // Generate reasoning
  let reasoning = '';
  if (trend === 'surging') {
    reasoning = `Strong upward momentum: Recent videos averaging ${recentAvgViews.toLocaleString()} views vs ${historicalAvgViews.toLocaleString()} historically. ${recentUploads} recent uploads indicate high activity.`;
  } else if (trend === 'growing') {
    reasoning = `Growing interest: Recent performance (${recentAvgViews.toLocaleString()} avg views) exceeds historical baseline (${historicalAvgViews.toLocaleString()} avg).`;
  } else if (trend === 'stable') {
    reasoning = `Stable interest: Recent and historical performance are consistent (${recentAvgViews.toLocaleString()} vs ${historicalAvgViews.toLocaleString()} avg views).`;
  } else {
    reasoning = `Declining momentum: Recent videos (${recentAvgViews.toLocaleString()} avg) underperforming historical average (${historicalAvgViews.toLocaleString()}).`;
  }
  
  return {
    recentAvgViews,
    historicalAvgViews,
    recentUploads,
    historicalUploads,
    momentumScore,
    trend,
    source: 'calculated',
    reasoning,
  };
}

// ============================================================================
// COMPETITION SCORE (From real market data)
// ============================================================================

/**
 * Calculate competition score from observable market factors
 */
export function calculateCompetitionScore(
  videos: YouTubeVideo[],
  channels: YouTubeChannel[]
): CompetitionScore {
  const weights = COMPETITION_WEIGHTS;
  
  // Factor 1: Video count (0-100)
  let videoCountScore = 0;
  if (videos.length > 100) videoCountScore = 100;
  else if (videos.length > 50) videoCountScore = 80;
  else if (videos.length > 25) videoCountScore = 60;
  else if (videos.length > 10) videoCountScore = 40;
  else videoCountScore = 20;
  
  // Factor 2: Channel authority (0-100)
  const avgSubscribers = channels.length > 0
    ? average(channels.map(c => safeParseInt(c.statistics.subscriberCount)))
    : 0;
  
  let channelAuthorityScore = 0;
  if (avgSubscribers > 1000000) channelAuthorityScore = 100;
  else if (avgSubscribers > 500000) channelAuthorityScore = 85;
  else if (avgSubscribers > 100000) channelAuthorityScore = 65;
  else if (avgSubscribers > 50000) channelAuthorityScore = 45;
  else if (avgSubscribers > 10000) channelAuthorityScore = 25;
  else channelAuthorityScore = 10;
  
  // Factor 3: View concentration (0-100)
  const views = videos.map(v => safeParseInt(v.statistics.viewCount)).sort((a, b) => b - a);
  const totalViews = views.reduce((sum, v) => sum + v, 0);
  const top20Percent = Math.ceil(views.length * 0.2);
  const top20Views = views.slice(0, top20Percent).reduce((sum, v) => sum + v, 0);
  const concentration = totalViews > 0 ? (top20Views / totalViews) * 100 : 0;
  const viewConcentrationScore = concentration; // Already 0-100
  
  // Factor 4: Recent activity (0-100)
  const recentVideos = videos.filter(v => isRecent(v.publishedAt, RESEARCH_PARAMS.recentDays)).length;
  const recentRatio = videos.length > 0 ? (recentVideos / videos.length) * 100 : 0;
  const recentActivityScore = Math.min(100, recentRatio * 2); // Scale up
  
  // Calculate weighted score
  const competitionScore = normalizeScore(
    videoCountScore * weights.videoCount +
    channelAuthorityScore * weights.channelAuthority +
    viewConcentrationScore * weights.viewConcentration +
    recentActivityScore * weights.recentActivity
  );
  
  const level = getCompetitionLevel(competitionScore);
  
  // Generate reasoning
  let reasoning = '';
  if (level === 'low') {
    reasoning = `Low competition: ${videos.length} videos, ${channels.length} channels averaging ${Math.round(avgSubscribers).toLocaleString()} subscribers. Good entry opportunity for new creators.`;
  } else if (level === 'moderate') {
    reasoning = `Moderate competition: ${videos.length} videos from ${channels.length} channels (avg ${Math.round(avgSubscribers).toLocaleString()} subs). ${concentration > 70 ? 'Views concentrated in top performers.' : 'Distributed performance indicates room for growth.'}`;
  } else {
    reasoning = `High competition: ${videos.length} videos, established channels (avg ${Math.round(avgSubscribers).toLocaleString()} subs), ${recentVideos} recent uploads. Requires strong differentiation.`;
  }
  
  return {
    videoCount: videos.length,
    channelAuthority: Math.round(avgSubscribers),
    viewConcentration: Math.round(concentration),
    recentActivity: recentVideos,
    competitionScore,
    level,
    source: 'calculated',
    breakdown: {
      videoCount: Math.round(videoCountScore),
      channelAuthority: Math.round(channelAuthorityScore),
      viewConcentration: Math.round(viewConcentrationScore),
      recentActivity: Math.round(recentActivityScore),
    },
    reasoning,
  };
}

// ============================================================================
// DIFFICULTY SCORE (From competition + accessibility)
// ============================================================================

/**
 * Calculate entry difficulty from competition and accessibility
 */
export function calculateDifficultyScore(
  competition: CompetitionScore,
  saturation: TopicSaturation,
  breakouts: BreakoutVideo[]
): DifficultyScore {
  const weights = DIFFICULTY_WEIGHTS;
  
  // Factor 1: Competition (0-100) - already calculated
  const competitionScore = competition.competitionScore;
  
  // Factor 2: Channel authority (0-100)
  const channelAuthorityScore = Math.min(100, (competition.channelAuthority / 1000000) * 100);
  
  // Factor 3: Topic saturation (0-100) - already calculated
  const topicSaturationScore = saturation.saturationScore;
  
  // Factor 4: Breakout accessibility (0-100)
  // More breakouts = more accessible (easier)
  // So we invert: (100 - accessibility)
  const breakoutRatio = breakouts.length / Math.max(1, competition.videoCount) * 100;
  const breakoutAccessibility = Math.min(100, breakoutRatio * 10); // Scale up
  
  // Calculate weighted score
  const difficultyScore = normalizeScore(
    competitionScore * weights.competition +
    channelAuthorityScore * weights.channelAuthority +
    topicSaturationScore * weights.topicSaturation +
    (100 - breakoutAccessibility) * weights.breakoutAccessibility
  );
  
  const level = getDifficultyLevel(difficultyScore);
  
  // Generate reasoning
  let reasoning = '';
  if (level === 'low') {
    reasoning = `Low difficulty: ${breakouts.length} breakout videos prove smaller channels can succeed. ${saturation.level === 'low' ? 'Low saturation provides entry opportunities.' : 'Despite moderate saturation, breakouts indicate accessibility.'}`;
  } else if (level === 'moderate') {
    reasoning = `Moderate difficulty: ${competition.level} competition, ${saturation.level} saturation. ${breakouts.length > 0 ? `${breakouts.length} breakout videos show opportunity with right approach.` : 'Requires strategic differentiation and quality execution.'}`;
  } else {
    reasoning = `High difficulty: High competition (${competition.videoCount} videos), established channels (${Math.round(competition.channelAuthority / 1000).toFixed(1)}K avg subs). ${breakouts.length > 0 ? `${breakouts.length} breakouts exist but require exceptional execution.` : 'Dominated by established creators.'}`;
  }
  
  return {
    competition: competitionScore,
    channelAuthority: Math.round(channelAuthorityScore),
    topicSaturation: topicSaturationScore,
    breakoutAccessibility: Math.round(breakoutAccessibility),
    difficultyScore,
    level,
    source: 'calculated',
    breakdown: {
      competition: Math.round(competitionScore),
      channelAuthority: Math.round(channelAuthorityScore),
      topicSaturation: Math.round(topicSaturationScore),
      breakoutAccessibility: Math.round(breakoutAccessibility),
    },
    reasoning,
  };
}
