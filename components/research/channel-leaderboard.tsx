'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import {
  Trophy, Users, Eye, TrendingUp, TrendingDown, BarChart3,
  Crown, Medal, Award, ExternalLink, PlayCircle, AlertCircle
} from 'lucide-react';

interface ChannelLeaderboardProps {
  channelLeaderboard: any[];
  searchQuery: string;
}

const container = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

export function ChannelLeaderboard({ channelLeaderboard, searchQuery }: ChannelLeaderboardProps) {
  const formatNumber = (num: string | number): string => {
    const n = typeof num === 'string' ? parseInt(num) : num;
    if (isNaN(n)) return '0';
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toString();
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return { icon: Crown, color: 'text-yellow-500', bg: 'bg-yellow-500/10' };
    if (rank === 2) return { icon: Medal, color: 'text-gray-400', bg: 'bg-gray-400/10' };
    if (rank === 3) return { icon: Award, color: 'text-amber-600', bg: 'bg-amber-600/10' };
    return { icon: Trophy, color: 'text-blue-500', bg: 'bg-blue-500/10' };
  };

  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-blue-500';
    if (score >= 40) return 'text-yellow-500';
    return 'text-red-500';
  };

  if (!channelLeaderboard || channelLeaderboard.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <AlertCircle className="w-12 h-12 mx-auto text-[hsl(var(--muted-foreground))] mb-4" />
          <p className="text-[hsl(var(--muted-foreground))]">No channel data available for "{searchQuery}"</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search Context */}
      <Card className="bg-blue-500/5 border-blue-500/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-blue-500" />
            <div>
              <p className="text-sm font-medium">Channel Rankings for: <span className="text-blue-500">"{searchQuery}"</span></p>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                Channels ranked by relevance, performance, and authority based on YouTube data
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Users className="w-4 h-4 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{channelLeaderboard.length}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">Channels Analyzed</p>
                <Badge variant="outline" className="text-[9px] mt-1">YouTube Data</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {Math.round(channelLeaderboard.reduce((sum, ch) => sum + ch.totalScore, 0) / channelLeaderboard.length)}
                </p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">Avg Opportunity Score</p>
                <Badge variant="outline" className="text-[9px] mt-1">AI Calculated</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Eye className="w-4 h-4 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {formatNumber(
                    channelLeaderboard.reduce((sum, ch) => sum + (ch.metrics?.avgViews || 0), 0) / channelLeaderboard.length
                  )}
                </p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">Avg Channel Views</p>
                <Badge variant="outline" className="text-[9px] mt-1">Calculated</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Channel Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5" />
            Channel Rankings
          </CardTitle>
          <CardDescription>
            Ranked by total opportunity score (relevance + performance + authority + consistency)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <motion.div variants={container} initial="hidden" animate="show" className="space-y-3">
            {channelLeaderboard.map((channel: any) => {
              const rankStyle = getRankIcon(channel.rank);
              const RankIcon = rankStyle.icon;

              return (
                <motion.div key={channel.channel.id} variants={item}>
                  <Card className="hover:border-[hsl(var(--primary))/40] transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        {/* Rank Badge */}
                        <div className={`w-12 h-12 rounded-full ${rankStyle.bg} flex items-center justify-center shrink-0`}>
                          <RankIcon className={`w-6 h-6 ${rankStyle.color}`} />
                        </div>

                        {/* Channel Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4 mb-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-semibold text-sm truncate">{channel.channel.title}</h4>
                                <Badge variant="outline" className="text-xs">#{channel.rank}</Badge>
                              </div>
                              <p className="text-xs text-[hsl(var(--muted-foreground))] line-clamp-2">
                                {channel.channel.description || 'No description available'}
                              </p>
                            </div>
                            
                            {/* Total Score */}
                            <div className="text-center shrink-0">
                              <div className={`text-2xl font-bold ${getScoreColor(channel.totalScore)}`}>
                                {Math.round(channel.totalScore)}
                              </div>
                              <div className="text-[10px] text-[hsl(var(--muted-foreground))]">Total Score</div>
                              <Badge variant="outline" className="text-[8px] mt-1">AI Score</Badge>
                            </div>
                          </div>

                          {/* Metrics Grid */}
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
                            <div className="text-center">
                              <div className="flex items-center justify-center gap-1 text-xs text-[hsl(var(--muted-foreground))] mb-1">
                                <Users className="w-3 h-3" />
                                Subscribers
                              </div>
                              <div className="font-semibold text-sm">{formatNumber(channel.metrics.subscribers)}</div>
                              <Badge variant="outline" className="text-[8px]">YouTube</Badge>
                            </div>

                            <div className="text-center">
                              <div className="flex items-center justify-center gap-1 text-xs text-[hsl(var(--muted-foreground))] mb-1">
                                <PlayCircle className="w-3 h-3" />
                                Videos
                              </div>
                              <div className="font-semibold text-sm">{formatNumber(channel.metrics.videoCount)}</div>
                              <Badge variant="outline" className="text-[8px]">YouTube</Badge>
                            </div>

                            <div className="text-center">
                              <div className="flex items-center justify-center gap-1 text-xs text-[hsl(var(--muted-foreground))] mb-1">
                                <Eye className="w-3 h-3" />
                                Avg Views
                              </div>
                              <div className="font-semibold text-sm">{formatNumber(channel.metrics.avgViews)}</div>
                              <Badge variant="outline" className="text-[8px]">Calculated</Badge>
                            </div>

                            <div className="text-center">
                              <div className="flex items-center justify-center gap-1 text-xs text-[hsl(var(--muted-foreground))] mb-1">
                                <BarChart3 className="w-3 h-3" />
                                Engagement
                              </div>
                              <div className="font-semibold text-sm">{channel.metrics.engagementRate.toFixed(1)}%</div>
                              <Badge variant="outline" className="text-[8px]">Calculated</Badge>
                            </div>

                            <div className="text-center">
                              <div className="flex items-center justify-center gap-1 text-xs text-[hsl(var(--muted-foreground))] mb-1">
                                <TrendingUp className="w-3 h-3" />
                                Upload Rate
                              </div>
                              <div className="font-semibold text-sm">{channel.metrics.uploadFrequency}</div>
                              <Badge variant="outline" className="text-[8px]">Calculated</Badge>
                            </div>
                          </div>

                          {/* Score Breakdown */}
                          <div className="grid grid-cols-4 gap-2 mb-3">
                            <div className="text-center p-2 bg-[hsl(var(--muted))/30] rounded">
                              <div className={`text-lg font-bold ${getScoreColor(channel.relevanceScore)}`}>
                                {Math.round(channel.relevanceScore)}
                              </div>
                              <div className="text-[10px] text-[hsl(var(--muted-foreground))]">Relevance</div>
                            </div>
                            <div className="text-center p-2 bg-[hsl(var(--muted))/30] rounded">
                              <div className={`text-lg font-bold ${getScoreColor(channel.performanceScore)}`}>
                                {Math.round(channel.performanceScore)}
                              </div>
                              <div className="text-[10px] text-[hsl(var(--muted-foreground))]">Performance</div>
                            </div>
                            <div className="text-center p-2 bg-[hsl(var(--muted))/30] rounded">
                              <div className={`text-lg font-bold ${getScoreColor(channel.authorityScore)}`}>
                                {Math.round(channel.authorityScore)}
                              </div>
                              <div className="text-[10px] text-[hsl(var(--muted-foreground))]">Authority</div>
                            </div>
                            <div className="text-center p-2 bg-[hsl(var(--muted))/30] rounded">
                              <div className={`text-lg font-bold ${getScoreColor(channel.consistencyScore)}`}>
                                {Math.round(channel.consistencyScore)}
                              </div>
                              <div className="text-[10px] text-[hsl(var(--muted-foreground))]">Consistency</div>
                            </div>
                          </div>

                          {/* Reasoning */}
                          {channel.reasoning && (
                            <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg mb-3">
                              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                                <Badge variant="outline" className="text-[8px] mr-2">AI Analysis</Badge>
                                {channel.reasoning}
                              </p>
                            </div>
                          )}

                          {/* Actions */}
                          <div className="flex items-center justify-between">
                            <Badge 
                              variant={channel.opportunity === 'High' ? 'default' : 'outline'} 
                              className="text-xs"
                            >
                              {channel.opportunity} Opportunity
                            </Badge>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="gap-1"
                              onClick={() => window.open(`https://youtube.com/channel/${channel.channel.id}`, '_blank')}
                            >
                              <ExternalLink className="w-3 h-3" />
                              View Channel
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

          {/* Data Labels */}
          <div className="mt-6 p-4 bg-[hsl(var(--muted))/30] rounded-lg">
            <p className="text-xs font-medium mb-2">Score Calculation:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-[hsl(var(--muted-foreground))]">
              <div>• <strong>Relevance:</strong> Match to search query "{searchQuery}"</div>
              <div>• <strong>Performance:</strong> Views, engagement, growth metrics</div>
              <div>• <strong>Authority:</strong> Subscriber count and total views</div>
              <div>• <strong>Consistency:</strong> Upload frequency and content quality</div>
            </div>
            <Badge variant="outline" className="text-[9px] mt-2">All scores are AI-calculated estimates</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
