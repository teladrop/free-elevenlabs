import { NextRequest, NextResponse } from 'next/server';
import { getChannelDetails, getChannelVideos, parseDuration } from '@/lib/youtube/api';

export async function GET(
  request: NextRequest,
  { params }: { params: { channelId: string } }
) {
  try {
    const { channelId } = params;

    if (!channelId) {
      return NextResponse.json(
        { error: 'Channel ID is required' },
        { status: 400 }
      );
    }

    // Get channel details and recent videos
    const [channelDetails, channelVideos] = await Promise.all([
      getChannelDetails(channelId),
      getChannelVideos(channelId, 20)
    ]);

    // Analyze channel performance
    const analysis = analyzeChannelPerformance(channelDetails, channelVideos);

    return NextResponse.json({
      channel: channelDetails,
      videos: channelVideos,
      analysis,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Channel analysis error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to analyze channel',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

function analyzeChannelPerformance(channel: any, videos: any[]) {
  const now = new Date();
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  
  // Recent activity analysis
  const recentVideos = videos.filter(v => new Date(v.publishedAt) > oneMonthAgo);
  const quarterlyVideos = videos.filter(v => new Date(v.publishedAt) > threeMonthsAgo);
  
  // Performance metrics
  const allViews = videos.map(v => parseInt(v.statistics.viewCount || '0'));
  const recentViews = recentVideos.map(v => parseInt(v.statistics.viewCount || '0'));
  
  const avgViews = allViews.reduce((sum, views) => sum + views, 0) / allViews.length;
  const recentAvgViews = recentViews.length > 0 
    ? recentViews.reduce((sum, views) => sum + views, 0) / recentViews.length 
    : 0;
  
  // Upload consistency
  const uploadFrequency = {
    monthly: recentVideos.length,
    quarterly: quarterlyVideos.length,
    avgPerMonth: quarterlyVideos.length / 3
  };

  // Video duration analysis
  const durations = videos.map(v => parseDuration(v.contentDetails.duration));
  const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
  
  // Performance trends
  const isGrowing = recentAvgViews > avgViews;
  const consistentUploads = uploadFrequency.monthly >= 2;
  
  // Content analysis
  const titlePatterns = analyzeContentPatterns(videos);
  
  return {
    metrics: {
      subscribers: parseInt(channel.statistics.subscriberCount || '0'),
      totalViews: parseInt(channel.statistics.viewCount || '0'),
      videoCount: parseInt(channel.statistics.videoCount || '0'),
      avgViews: Math.round(avgViews),
      recentAvgViews: Math.round(recentAvgViews),
      avgDuration: Math.round(avgDuration),
    },
    activity: {
      uploadFrequency,
      recentUploads: recentVideos.length,
      lastUpload: videos[0]?.publishedAt || null,
      isActive: recentVideos.length > 0
    },
    performance: {
      isGrowing,
      consistentUploads,
      viewGrowth: recentAvgViews > 0 ? ((recentAvgViews - avgViews) / avgViews * 100) : 0,
      topVideo: videos.reduce((top, current) => 
        parseInt(current.statistics.viewCount || '0') > parseInt(top.statistics.viewCount || '0') 
          ? current : top, videos[0]
      )
    },
    content: {
      titlePatterns,
      avgTitleLength: Math.round(
        videos.reduce((sum, v) => sum + v.title.length, 0) / videos.length
      ),
      avgDurationFormatted: formatDuration(avgDuration)
    }
  };
}

function analyzeContentPatterns(videos: any[]) {
  const titles = videos.map(v => v.title);
  
  // Common formats
  const formats = [
    'How to', 'Ultimate', 'Best', 'Top', 'Complete', 'Guide',
    'Tutorial', 'Review', 'Comparison', 'Tips', 'Secrets', 'Mistakes'
  ];
  
  const formatCounts = formats.map(format => ({
    format,
    count: titles.filter(title => 
      title.toLowerCase().includes(format.toLowerCase())
    ).length,
    percentage: Math.round(
      (titles.filter(title => 
        title.toLowerCase().includes(format.toLowerCase())
      ).length / titles.length) * 100
    )
  })).filter(f => f.count > 0);

  // Most common first words
  const firstWords = titles.map(title => title.split(' ')[0].toLowerCase());
  const firstWordCounts = firstWords.reduce((acc: any, word) => {
    acc[word] = (acc[word] || 0) + 1;
    return acc;
  }, {});

  const topFirstWords = Object.entries(firstWordCounts)
    .sort(([,a], [,b]) => (b as number) - (a as number))
    .slice(0, 5)
    .map(([word, count]) => ({ word, count }));

  return {
    commonFormats: formatCounts.sort((a, b) => b.count - a.count),
    topFirstWords,
    seriesContent: identifySeries(titles)
  };
}

function identifySeries(titles: string[]): any[] {
  // Simple series detection based on similar title patterns
  const series: { [key: string]: number } = {};
  
  titles.forEach(title => {
    const words = title.split(' ');
    if (words.length > 2) {
      const firstTwo = words.slice(0, 2).join(' ').toLowerCase();
      series[firstTwo] = (series[firstTwo] || 0) + 1;
    }
  });

  return Object.entries(series)
    .filter(([, count]) => count >= 3) // At least 3 videos with similar start
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([pattern, count]) => ({ pattern, count }));
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}