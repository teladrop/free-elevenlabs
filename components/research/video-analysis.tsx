'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { motion } from 'framer-motion';
import {
  Eye, Calendar, Clock, BarChart3, TrendingUp, TrendingDown,
  PlayCircle, MessageCircle, ThumbsUp, ExternalLink,
  Filter, SortAsc, Hash, Target, Zap, AlertCircle
} from 'lucide-react';

interface VideoAnalysisProps {
  videos: any[];
  videoAnalysis: any;
  searchQuery: string;
}

const container = { hidden: {}, show: { transition: { staggerChildren: 0.03 } } };
const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

export function VideoAnalysis({ videos, videoAnalysis, searchQuery }: VideoAnalysisProps) {
  const [sortBy, setSortBy] = useState<'views' | 'date' | 'engagement'>('views');
  const [filterDate, setFilterDate] = useState<'all' | 'week' | 'month' | 'year'>('all');

  const formatNumber = (num: string | number): string => {
    const n = typeof num === 'string' ? parseInt(num) : num;
    if (isNaN(n)) return '0';
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toString();
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 30) return `${diffDays} days ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  const parseDuration = (duration: string): number => {
    if (!duration) return 0;
    const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    if (!match) return 0;

    const hours = (match[1] ? parseInt(match[1]) : 0);
    const minutes = (match[2] ? parseInt(match[2]) : 0);
    const seconds = (match[3] ? parseInt(match[3]) : 0);

    return hours * 3600 + minutes * 60 + seconds;
  };

  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const getEngagementRate = (video: any): number => {
    const views = parseInt(video.statistics.viewCount || '0');
    const likes = parseInt(video.statistics.likeCount || '0');
    const comments = parseInt(video.statistics.commentCount || '0');
    
    if (views === 0) return 0;
    return ((likes + comments) / views) * 100;
  };

  const getPerformanceCategory = (video: any): { label: string; color: string; icon: any } => {
    const views = parseInt(video.statistics.viewCount || '0');
    
    if (views > 1000000) {
      return { label: 'Viral', color: 'text-red-500 bg-red-500/10 border-red-500/20', icon: TrendingUp };
    } else if (views > 100000) {
      return { label: 'High', color: 'text-green-500 bg-green-500/10 border-green-500/20', icon: TrendingUp };
    } else if (views > 10000) {
      return { label: 'Good', color: 'text-blue-500 bg-blue-500/10 border-blue-500/20', icon: BarChart3 };
    } else {
      return { label: 'Low', color: 'text-gray-500 bg-gray-500/10 border-gray-500/20', icon: TrendingDown };
    }
  };

  const sortVideos = (videos: any[]) => {
    return [...videos].sort((a, b) => {
      switch (sortBy) {
        case 'views':
          return parseInt(b.statistics.viewCount || '0') - parseInt(a.statistics.viewCount || '0');
        case 'date':
          return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
        case 'engagement':
          return getEngagementRate(b) - getEngagementRate(a);
        default:
          return 0;
      }
    });
  };

  const filterVideos = (videos: any[]) => {
    if (filterDate === 'all') return videos;

    const now = new Date();
    return videos.filter(video => {
      const videoDate = new Date(video.publishedAt);
      const diffTime = now.getTime() - videoDate.getTime();
      const diffDays = diffTime / (1000 * 60 * 60 * 24);
      
      if (filterDate === 'week') return diffDays <= 7;
      if (filterDate === 'month') return diffDays <= 30;
      if (filterDate === 'year') return diffDays <= 365;
      return true;
    });
  };

  const processedVideos = sortVideos(filterVideos(videos));
  const titlePatterns = extractTitlePatterns(processedVideos);
  const performanceInsights = analyzePerformance(processedVideos);

  return (
    <div className="space-y-6">
      {/* Analytics Overview - YouTube Data */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <PlayCircle className="w-4 h-4 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{videos.length}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">Videos Found</p>
                <Badge variant="outline" className="text-[10px] mt-1">YouTube Data</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                <Eye className="w-4 h-4 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatNumber(videoAnalysis.averageViews)}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">Avg Views</p>
                <Badge variant="outline" className="text-[10px] mt-1">Calculated</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Clock className="w-4 h-4 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{Math.round(videoAnalysis.avgTitleLength)}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">Avg Title Length</p>
                <Badge variant="outline" className="text-[10px] mt-1">Calculated</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <Calendar className="w-4 h-4 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{videoAnalysis.recentVideos.lastWeek}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">This Week</p>
                <Badge variant="outline" className="text-[10px] mt-1">YouTube Data</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search Context Banner */}
      <Card className="bg-blue-500/5 border-blue-500/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-blue-500" />
            <div>
              <p className="text-sm font-medium">Researching: <span className="text-blue-500">"{searchQuery}"</span></p>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                All data on this page is derived from actual YouTube search results for this query
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="videos" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="videos">Videos</TabsTrigger>
          <TabsTrigger value="patterns">Title Patterns</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="insights">AI Analysis</TabsTrigger>
        </TabsList>

        {/* Video List Tab */}
        <TabsContent value="videos" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <SortAsc className="w-4 h-4" />
                  <span className="text-sm font-medium">Sort:</span>
                  <div className="flex gap-1">
                    {[
                      { key: 'views', label: 'Views' },
                      { key: 'date', label: 'Date' },
                      { key: 'engagement', label: 'Engagement' }
                    ].map(option => (
                      <Button
                        key={option.key}
                        variant={sortBy === option.key ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSortBy(option.key as any)}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  <span className="text-sm font-medium">Time:</span>
                  <div className="flex gap-1">
                    {[
                      { key: 'all', label: 'All Time' },
                      { key: 'week', label: 'Week' },
                      { key: 'month', label: 'Month' },
                      { key: 'year', label: 'Year' }
                    ].map(option => (
                      <Button
                        key={option.key}
                        variant={filterDate === option.key ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setFilterDate(option.key as any)}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Video List */}
          <motion.div variants={container} initial="hidden" animate="show" className="space-y-3">
            {processedVideos.map((video: any, index: number) => {
              const performance = getPerformanceCategory(video);
              const engagement = getEngagementRate(video);
              const duration = parseDuration(video.contentDetails?.duration || '');

              return (
                <motion.div key={video.id} variants={item}>
                  <Card className="hover:border-[hsl(var(--primary))/40] transition-colors">
                    <CardContent className="p-4">
                      <div className="flex gap-4">
                        {/* Thumbnail */}
                        <div className="relative shrink-0">
                          <img 
                            src={video.thumbnails.medium.url} 
                            alt=""
                            className="w-40 h-24 object-cover rounded-lg"
                          />
                          {duration > 0 && (
                            <div className="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1 rounded">
                              {formatDuration(duration)}
                            </div>
                          )}
                          <Badge className={`absolute top-1 left-1 text-xs ${performance.color}`}>
                            <performance.icon className="w-3 h-3 mr-1" />
                            {performance.label}
                          </Badge>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <h4 className="font-semibold text-sm line-clamp-2 flex-1">{video.title}</h4>
                            <div className="text-right shrink-0">
                              <div className="text-sm font-bold text-[hsl(var(--muted-foreground))]">#{index + 1}</div>
                            </div>
                          </div>

                          <p className="text-xs text-[hsl(var(--muted-foreground))] mb-3">{video.channelTitle}</p>

                          {/* Metrics - Real YouTube Data */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                            <div className="text-center">
                              <div className="flex items-center justify-center gap-1 text-xs text-[hsl(var(--muted-foreground))] mb-1">
                                <Eye className="w-3 h-3" />
                                Views
                              </div>
                              <div className="font-semibold text-sm">{formatNumber(video.statistics.viewCount)}</div>
                            </div>
                            
                            <div className="text-center">
                              <div className="flex items-center justify-center gap-1 text-xs text-[hsl(var(--muted-foreground))] mb-1">
                                <ThumbsUp className="w-3 h-3" />
                                Likes
                              </div>
                              <div className="font-semibold text-sm">{formatNumber(video.statistics.likeCount || '0')}</div>
                            </div>

                            <div className="text-center">
                              <div className="flex items-center justify-center gap-1 text-xs text-[hsl(var(--muted-foreground))] mb-1">
                                <MessageCircle className="w-3 h-3" />
                                Comments
                              </div>
                              <div className="font-semibold text-sm">{formatNumber(video.statistics.commentCount || '0')}</div>
                            </div>

                            <div className="text-center">
                              <div className="flex items-center justify-center gap-1 text-xs text-[hsl(var(--muted-foreground))] mb-1">
                                <BarChart3 className="w-3 h-3" />
                                Engagement
                              </div>
                              <div className="font-semibold text-sm">{engagement.toFixed(2)}%</div>
                              <Badge variant="outline" className="text-[9px] mt-1">Calculated</Badge>
                            </div>
                          </div>

                          {/* Footer */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))]">
                              <Calendar className="w-3 h-3" />
                              {formatDate(video.publishedAt)}
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="gap-1"
                              onClick={() => window.open(`https://youtube.com/watch?v=${video.id}`, '_blank')}
                            >
                              <ExternalLink className="w-3 h-3" />
                              View
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>

          {processedVideos.length === 0 && (
            <Card className="p-8 text-center">
              <p className="text-[hsl(var(--muted-foreground))]">No videos match the current filters</p>
            </Card>
          )}
        </TabsContent>

        {/* Title Patterns Tab */}
        <TabsContent value="patterns">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Hash className="w-5 h-5" />
                  Most Common Words in Titles
                </CardTitle>
                <CardDescription>
                  <Badge variant="outline" className="text-[10px]">Calculated from YouTube Data</Badge>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {videoAnalysis.commonTitleWords.slice(0, 15).map((word: string, index: number) => {
                    const count = titlePatterns.wordFrequency[word] || 0;
                    const percentage = Math.round((count / videos.length) * 100);
                    
                    return (
                      <div key={word} className="flex items-center justify-between">
                        <span className="text-sm font-mono">"{word}"</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{count} videos</Badge>
                          <span className="text-xs text-[hsl(var(--muted-foreground))]">{percentage}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  Common Title Patterns
                </CardTitle>
                <CardDescription>
                  <Badge variant="outline" className="text-[10px]">AI Analysis</Badge>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {titlePatterns.commonFormats.map((format: any) => (
                    <div key={format.format} className="flex items-center justify-between">
                      <span className="text-sm font-medium">"{format.format}"</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{format.count} videos</Badge>
                        <Badge variant="outline">{format.percentage}%</Badge>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-4 p-3 bg-[hsl(var(--muted))/30] rounded">
                  These patterns are detected from actual video titles in the search results for "{searchQuery}"
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Performance Distribution</CardTitle>
                <CardDescription>
                  <Badge variant="outline" className="text-[10px]">Calculated from YouTube Data</Badge>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {performanceInsights.categories.map((category: any) => (
                    <div key={category.label} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{category.label}</span>
                        <span className="text-sm text-[hsl(var(--muted-foreground))]">
                          {category.count} videos ({category.percentage}%)
                        </span>
                      </div>
                      <div className="w-full bg-[hsl(var(--muted))] rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${category.color}`}
                          style={{ width: `${category.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Performer</CardTitle>
                <CardDescription>Highest views</CardDescription>
              </CardHeader>
              <CardContent>
                {videoAnalysis.topPerformer ? (
                  <div className="space-y-3">
                    <img 
                      src={videoAnalysis.topPerformer.thumbnails.medium.url}
                      alt=""
                      className="w-full h-24 object-cover rounded-lg"
                    />
                    <h4 className="font-semibold text-sm line-clamp-3">
                      {videoAnalysis.topPerformer.title}
                    </h4>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span>Views:</span>
                        <span className="font-semibold">{formatNumber(videoAnalysis.topPerformer.statistics.viewCount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Channel:</span>
                        <span className="font-semibold truncate max-w-[120px]">{videoAnalysis.topPerformer.channelTitle}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Published:</span>
                        <span className="font-semibold">{formatDate(videoAnalysis.topPerformer.publishedAt)}</span>
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full gap-1"
                      onClick={() => window.open(`https://youtube.com/watch?v=${videoAnalysis.topPerformer.id}`, '_blank')}
                    >
                      <ExternalLink className="w-3 h-3" />
                      View on YouTube
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">No data available</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* AI Insights Tab */}
        <TabsContent value="insights">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5" />
                AI-Generated Content Insights
              </CardTitle>
              <CardDescription>
                Intelligent analysis based on actual video performance data from YouTube
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Badge variant="outline" className="text-xs">AI Analysis</Badge>
              
              {generateAIInsights(processedVideos, videoAnalysis, searchQuery).map((insight: any, index: number) => (
                <div key={index} className={`p-4 rounded-lg border ${
                  insight.type === 'opportunity' ? 'border-green-500/20 bg-green-500/5' : 
                  insight.type === 'warning' ? 'border-yellow-500/20 bg-yellow-500/5' : 
                  'border-blue-500/20 bg-blue-500/5'
                }`}>
                  <div className="flex items-start gap-3">
                    <insight.icon className={`w-5 h-5 mt-0.5 ${
                      insight.type === 'opportunity' ? 'text-green-500' : 
                      insight.type === 'warning' ? 'text-yellow-500' : 
                      'text-blue-500'
                    }`} />
                    <div>
                      <h4 className="font-semibold text-sm mb-1">{insight.title}</h4>
                      <p className="text-sm text-[hsl(var(--muted-foreground))]">{insight.description}</p>
                      {insight.recommendation && (
                        <p className="text-sm font-medium mt-2 text-blue-600 dark:text-blue-400">
                          💡 {insight.recommendation}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Helper: Extract actual title patterns from real data
function extractTitlePatterns(videos: any[]) {
  const wordFrequency: { [key: string]: number } = {};
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were']);
  
  videos.forEach(video => {
    const words = video.title.toLowerCase().match(/\b\w+\b/g) || [];
    words.forEach((word: string) => {
      if (word.length > 2 && !stopWords.has(word)) {
        wordFrequency[word] = (wordFrequency[word] || 0) + 1;
      }
    });
  });

  // Detect actual patterns from titles
  const patterns = [
    'how to', 'ultimate', 'best', 'top', 'complete', 'guide',
    'tutorial', 'review', 'tips', 'secrets', 'mistakes', 'beginner',
    'advanced', 'explained', 'vs', 'why', 'what', 'when', 'where'
  ];

  const commonFormats = patterns
    .map(pattern => {
      const count = videos.filter(v => 
        v.title.toLowerCase().includes(pattern.toLowerCase())
      ).length;
      return {
        format: pattern,
        count,
        percentage: videos.length > 0 ? Math.round((count / videos.length) * 100) : 0
      };
    })
    .filter(f => f.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return { wordFrequency, commonFormats };
}

// Helper: Analyze actual performance from YouTube data
function analyzePerformance(videos: any[]) {
  const categories = [
    { label: 'Viral (>1M views)', min: 1000000, color: 'bg-red-500', count: 0, percentage: 0 },
    { label: 'High (100K-1M)', min: 100000, max: 1000000, color: 'bg-green-500', count: 0, percentage: 0 },
    { label: 'Good (10K-100K)', min: 10000, max: 100000, color: 'bg-blue-500', count: 0, percentage: 0 },
    { label: 'Low (<10K)', min: 0, max: 10000, color: 'bg-gray-500', count: 0, percentage: 0 }
  ];

  videos.forEach(video => {
    const views = parseInt(video.statistics.viewCount || '0');
    for (const category of categories) {
      const inRange = views >= category.min && (!category.max || views < category.max);
      if (inRange) {
        category.count++;
        break;
      }
    }
  });

  categories.forEach(category => {
    category.percentage = videos.length > 0 ? Math.round((category.count / videos.length) * 100) : 0;
  });

  return { categories };
}

// Helper: Generate AI insights from real data
function generateAIInsights(videos: any[], analysis: any, query: string) {
  const insights = [];
  
  if (videos.length === 0) {
    insights.push({
      type: 'warning',
      icon: AlertCircle,
      title: 'No Videos Found',
      description: `No YouTube results found for "${query}". Try a different search term.`
    });
    return insights;
  }

  const avgViews = videos.reduce((sum, v) => sum + parseInt(v.statistics.viewCount || '0'), 0) / videos.length;
  const recentVideos = videos.filter(v => {
    const daysDiff = (Date.now() - new Date(v.publishedAt).getTime()) / (1000 * 60 * 60 * 24);
    return daysDiff <= 30;
  });

  // Volume insight
  if (videos.length < 20) {
    insights.push({
      type: 'opportunity',
      icon: Target,
      title: 'Limited Competition Detected',
      description: `Only ${videos.length} videos found for "${query}". Lower competition could mean easier ranking opportunities.`,
      recommendation: 'Consider creating comprehensive content to establish early presence in this space.'
    });
  }

  // Performance insight
  const highPerformers = videos.filter(v => parseInt(v.statistics.viewCount || '0') > avgViews * 2);
  if (highPerformers.length > 0) {
    insights.push({
      type: 'insight',
      icon: TrendingUp,
      title: 'High Performers Identified',
      description: `${highPerformers.length} videos significantly outperform the average (${Math.round(avgViews).toLocaleString()} views).`,
      recommendation: 'Study these top performers for successful title patterns, thumbnails, and content angles.'
    });
  }

  // Recency insight
  const recentRatio = recentVideos.length / videos.length;
  if (recentRatio < 0.2) {
    insights.push({
      type: 'opportunity',
      icon: Clock,
      title: 'Content Freshness Gap',
      description: `Only ${Math.round(recentRatio * 100)}% of content is recent. Most videos are older.`,
      recommendation: 'Opportunity exists for fresh, updated content with current information and trends.'
    });
  } else if (recentRatio > 0.5) {
    insights.push({
      type: 'warning',
      icon: Clock,
      title: 'High Publishing Activity',
      description: `${Math.round(recentRatio * 100)}% of videos are less than 30 days old, indicating active competition.`,
      recommendation: 'Focus on differentiation and unique angles to stand out in this active niche.'
    });
  }

  return insights;
}
