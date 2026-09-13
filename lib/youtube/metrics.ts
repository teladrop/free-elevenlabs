/**
 * YouTube Performance Metrics Calculator
 * All calculations based on REAL YouTube data - NO fabricated metrics
 */

import { YouTubeVideo, YouTubeChannel, parseDuration } from './api';

export interface VideoMetrics {
  viewsPerDay: number;
  viewsPerSubscriber: number;
  engagementRate: number;
  breakoutRatio: number;
  daysOld: number;
  duration: number;
}

export interface ChannelMetrics {
  avgViews: number;
  recentAvgViews: number;
  uploadFrequency: number;
  viewsPerSubscriber: number;
  recentPerformanceIndex: number;
}

/**
 * Calculate video performance metrics from YouTube data
 */
export function calculateVideoMetrics(
  video: YouTubeVideo,
  channelSubscribers: number
): VideoMetrics {
  const views = parseInt(video.statistics.viewCount || '0');
  const likes = parseInt(video.statistics.likeCount || '0');
  const comments = parseInt(video.statistics.commentCount || '0');
  
  const publishedDate = new Date(video.publishedAt);
  const now = new Date();
  const daysOld = Math.max(1, Math.floor((now.getTime() - publishedDate.getTime()) / (1000 * 60 * 60 * 24)));
  
  const duration = parseDuration(video.contentDetails.duration);
  
  // Views per day (velocity)
  const viewsPerDay = views / daysOld;
  
  // Views per subscriber (breakout indicator)
  const viewsPerSubscriber = channelSubscribers > 0 ? views / channelSubscribers : 0;
  
  // Engagement rate: (likes + comments) / views
  const engagementRate = views > 0 ? ((likes + comments) / views) * 100 : 0;
  
  // Breakout ratio: how many times subscriber count the video reached
  const breakoutRatio = channelSubscribers > 0 ? views / channelSubscribers : 0;
  
  return {
    viewsPerDay,
    viewsPerSubscriber,
    engagementRate,
    breakoutRatio,
    daysOld,
    duration
  };
}

/**
 * Calculate channel performance metrics
 */
export function calculateChannelMetrics(
  channel: YouTubeChannel,
  channelVideos: YouTubeVideo[]
): ChannelMetrics {
  const subscribers = parseInt(channel.statistics.subscriberCount || '0');
  const totalViews = parseInt(channel.statistics.viewCount || '0');
  const videoCount = parseInt(channel.statistics.videoCount || '0');
  
  // Average views per video
  const avgViews = videoCount > 0 ? totalViews / videoCount : 0;
  
  // Recent average views (last 10 videos)
  const recentVideos = channelVideos.slice(0, 10);
  const recentTotalViews = recentVideos.reduce((sum, video) => 
    sum + parseInt(video.statistics.viewCount || '0'), 0);
  const recentAvgViews = recentVideos.length > 0 ? recentTotalViews / recentVideos.length : 0;
  
  // Upload frequency (videos per month based on recent uploads)
  const now = new Date();
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const recentUploads = recentVideos.filter(video => 
    new Date(video.publishedAt) > oneMonthAgo).length;
  
  // Recent performance index: recent avg / historical avg
  const recentPerformanceIndex = avgViews > 0 ? (recentAvgViews / avgViews) * 100 : 100;
  
  // Views per subscriber
  const viewsPerSubscriber = subscribers > 0 ? avgViews / subscribers : 0;
  
  return {
    avgViews: Math.round(avgViews),
    recentAvgViews: Math.round(recentAvgViews),
    uploadFrequency: recentUploads,
    viewsPerSubscriber,
    recentPerformanceIndex
  };
}

/**
 * Identify breakout videos (videos that significantly outperform channel size)
 */
export function identifyBreakoutVideos(
  videos: YouTubeVideo[],
  channelData: Map<string, number> // channelId -> subscriber count
): Array<{
  video: YouTubeVideo;
  breakoutRatio: number;
  subscribers: number;
  category: 'major-breakout' | 'breakout' | 'strong' | 'normal' | 'underperforming';
}> {
  return videos.map(video => {
    const subscribers = channelData.get(video.channelId) || 0;
    const views = parseInt(video.statistics.viewCount || '0');
    const breakoutRatio = subscribers > 0 ? views / subscribers : 0;
    
    let category: 'major-breakout' | 'breakout' | 'strong' | 'normal' | 'underperforming';
    if (breakoutRatio >= 10) category = 'major-breakout';
    else if (breakoutRatio >= 5) category = 'breakout';
    else if (breakoutRatio >= 2) category = 'strong';
    else if (breakoutRatio >= 1) category = 'normal';
    else category = 'underperforming';
    
    return {
      video,
      breakoutRatio,
      subscribers,
      category
    };
  }).filter(item => item.breakoutRatio >= 5); // Only return actual breakouts
}

/**
 * Calculate topic saturation from observable data
 */
export function calculateTopicSaturation(
  videos: YouTubeVideo[],
  channels: YouTubeChannel[]
): {
  level: 'low' | 'moderate' | 'high';
  score: number;
  factors: {
    videoCount: number;
    channelCount: number;
    avgChannelSize: number;
    recentActivity: number;
    viewConcentration: number;
  };
} {
  const videoCount = videos.length;
  const channelCount = channels.length;
  
  // Average channel size
  const totalSubs = channels.reduce((sum, c) => sum + parseInt(c.statistics.subscriberCount || '0'), 0);
  const avgChannelSize = channels.length > 0 ? totalSubs / channels.length : 0;
  
  // Recent activity (videos in last 30 days)
  const now = new Date();
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const recentVideos = videos.filter(v => new Date(v.publishedAt) > oneMonthAgo);
  const recentActivity = recentVideos.length;
  
  // View concentration (what % of views go to top 20% of videos)
  const sortedViews = videos
    .map(v => parseInt(v.statistics.viewCount || '0'))
    .sort((a, b) => b - a);
  const top20Count = Math.ceil(sortedViews.length * 0.2);
  const top20Views = sortedViews.slice(0, top20Count).reduce((sum, v) => sum + v, 0);
  const totalViews = sortedViews.reduce((sum, v) => sum + v, 0);
  const viewConcentration = totalViews > 0 ? (top20Views / totalViews) * 100 : 0;
  
  // Calculate saturation score (0-100)
  let score = 0;
  
  // Video count factor (0-30 points)
  if (videoCount > 100) score += 30;
  else if (videoCount > 50) score += 20;
  else if (videoCount > 25) score += 10;
  else score += 5;
  
  // Channel size factor (0-25 points)
  if (avgChannelSize > 500000) score += 25;
  else if (avgChannelSize > 100000) score += 15;
  else if (avgChannelSize > 10000) score += 8;
  
  // Recent activity factor (0-25 points)
  if (recentActivity > 20) score += 25;
  else if (recentActivity > 10) score += 15;
  else if (recentActivity > 5) score += 8;
  
  // View concentration factor (0-20 points)
  // Lower concentration = more competition = higher saturation
  if (viewConcentration < 50) score += 20; // Views are spread out
  else if (viewConcentration < 70) score += 10;
  
  let level: 'low' | 'moderate' | 'high';
  if (score < 35) level = 'low';
  else if (score < 65) level = 'moderate';
  else level = 'high';
  
  return {
    level,
    score,
    factors: {
      videoCount,
      channelCount,
      avgChannelSize: Math.round(avgChannelSize),
      recentActivity,
      viewConcentration: Math.round(viewConcentration)
    }
  };
}

/**
 * Calculate competition score from observable data
 */
export function calculateCompetitionScore(videos: YouTubeVideo[], channels: YouTubeChannel[]): {
  score: number;
  level: 'low' | 'medium' | 'high';
  reasoning: string;
} {
  // Number of high-performing videos
  const avgViews = videos.reduce((sum, v) => sum + parseInt(v.statistics.viewCount || '0'), 0) / videos.length;
  const highPerformers = videos.filter(v => parseInt(v.statistics.viewCount || '0') > avgViews * 1.5).length;
  
  // Number of established channels
  const establishedChannels = channels.filter(c => parseInt(c.statistics.subscriberCount || '0') > 100000).length;
  
  // Median subscriber size
  const subscriberCounts = channels.map(c => parseInt(c.statistics.subscriberCount || '0')).sort((a, b) => a - b);
  const medianSubs = subscriberCounts[Math.floor(subscriberCounts.length / 2)] || 0;
  
  // Recent uploads
  const now = new Date();
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const recentUploads = videos.filter(v => new Date(v.publishedAt) > oneMonthAgo).length;
  
  // Calculate score (0-100)
  let score = 0;
  
  // High performer factor
  score += Math.min(30, (highPerformers / videos.length) * 100);
  
  // Established channel factor
  score += Math.min(30, (establishedChannels / channels.length) * 60);
  
  // Median subscriber factor
  if (medianSubs > 500000) score += 20;
  else if (medianSubs > 100000) score += 12;
  else if (medianSubs > 10000) score += 6;
  
  // Recent activity factor
  if (recentUploads > 15) score += 20;
  else if (recentUploads > 8) score += 12;
  else if (recentUploads > 3) score += 6;
  
  score = Math.round(Math.min(100, score));
  
  let level: 'low' | 'medium' | 'high';
  let reasoning: string;
  
  if (score < 40) {
    level = 'low';
    reasoning = 'Few recent videos and limited presence of large established channels indicates lower competition.';
  } else if (score < 70) {
    level = 'medium';
    reasoning = 'Moderate number of established channels with regular uploads indicates medium competition.';
  } else {
    level = 'high';
    reasoning = 'High concentration of established channels with strong performance indicates high competition.';
  }
  
  return { score, level, reasoning };
}

/**
 * Extract common title words from REAL video titles
 */
export function extractCommonTitleWords(videos: YouTubeVideo[], limit: number = 15): Array<{
  word: string;
  count: number;
  percentage: number;
}> {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 
    'of', 'with', 'by', 'how', 'what', 'why', 'when', 'where', 'is', 'are',
    'you', 'your', 'this', 'that', 'from', 'they', 'have', 'will', 'can'
  ]);
  
  const wordCount: { [key: string]: number } = {};
  
  videos.forEach(video => {
    const words = video.title.toLowerCase().match(/\b\w+\b/g) || [];
    words.forEach(word => {
      if (word.length > 2 && !stopWords.has(word)) {
        wordCount[word] = (wordCount[word] || 0) + 1;
      }
    });
  });
  
  return Object.entries(wordCount)
    .map(([word, count]) => ({
      word,
      count,
      percentage: Math.round((count / videos.length) * 100)
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
