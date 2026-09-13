/**
 * YouTube Research System - Data Types
 * 
 * Clear separation of:
 * - YouTube Data (from API)
 * - Calculated Metrics (from real data)
 * - AI Analysis (pattern interpretation)
 * - AI Generated (new content creation)
 */

// ============================================================================
// SOURCE LABELS
// ============================================================================

export type DataSource =
  | 'youtube-data'
  | 'calculated'
  | 'ai-analysis'
  | 'ai-generated';

export type SearchTermSource =
  | 'user_query'
  | 'youtube_autocomplete'
  | 'google_autocomplete'
  | 'google_trends';

export const SEARCH_SOURCE_LABEL: Record<SearchTermSource, string> = {
  user_query: 'User query',
  youtube_autocomplete: 'YouTube search suggestions',
  google_autocomplete: 'Google search suggestions',
  google_trends: 'Google Trends (YouTube)',
};

// ============================================================================
// YOUTUBE DATA (Real API responses)
// ============================================================================

export interface YouTubeVideo {
  // Core identification
  videoId: string;
  title: string;
  channelId: string;
  channelTitle: string;
  
  // Metadata
  publishedAt: string; // ISO date
  description: string;
  thumbnails: {
    default: { url: string; width: number; height: number };
    medium: { url: string; width: number; height: number };
    high: { url: string; width: number; height: number };
  };
  
  // Statistics (when available)
  statistics: {
    viewCount: string;
    likeCount?: string;
    commentCount?: string;
  };
  
  // Content details
  contentDetails: {
    duration: string; // ISO 8601 duration
  };
  
  // Provenance
  source: 'youtube-data';
  retrievedAt: string; // ISO date
}

export interface YouTubeChannel {
  // Core identification
  channelId: string;
  title: string;
  description: string;
  customUrl?: string;
  
  // Visual
  thumbnails: {
    default: { url: string; width: number; height: number };
    medium: { url: string; width: number; height: number };
    high: { url: string; width: number; height: number };
  };
  
  // Statistics
  statistics: {
    viewCount: string;
    subscriberCount: string;
    hiddenSubscriberCount: boolean;
    videoCount: string;
  };
  
  // Metadata
  publishedAt: string; // ISO date
  
  // Provenance
  source: 'youtube-data';
  retrievedAt: string; // ISO date
}

export interface YouTubeSearchResult {
  query: string;
  videos: YouTubeVideo[];
  channels: YouTubeChannel[];
  totalResults: number;
  retrievedAt: string; // ISO date
  source: 'youtube-data';
}

// ============================================================================
// CALCULATED METRICS (From real YouTube data)
// ============================================================================

export interface VideoMetrics {
  videoId: string;
  
  // Performance metrics
  views: number;
  likes: number;
  comments: number;
  engagementRate: number; // (likes + comments) / views
  
  // Temporal metrics
  publishedAt: Date;
  ageInDays: number;
  viewsPerDay: number;
  
  // Channel context
  channelSubscribers: number;
  viewsToSubsRatio: number; // views / subscribers
  
  // Duration
  durationSeconds: number;
  
  // Provenance
  source: 'calculated';
  calculatedAt: string; // ISO date
}

export interface BreakoutVideo {
  video: YouTubeVideo;
  metrics: VideoMetrics;
  
  // Breakout analysis
  breakoutRatio: number; // views / channel_subscribers
  label: 'below' | 'normal' | 'strong' | 'breakout' | 'major-breakout';
  
  // Context
  reasoning: string;
  
  // Provenance
  source: 'calculated';
  calculatedAt: string; // ISO date
}

export interface ChannelMetrics {
  channelId: string;
  
  // Basic stats
  subscribers: number;
  totalViews: number;
  videoCount: number;
  
  // Research context
  relevantVideos: number;
  avgViewsPerVideo: number;
  medianViewsPerVideo: number;
  bestVideo: YouTubeVideo;
  
  // Activity
  recentUploads: number; // Last 30 days
  uploadFrequency: number; // Videos per month
  
  // Performance
  avgEngagementRate: number;
  
  // Provenance
  source: 'calculated';
  calculatedAt: string; // ISO date
}

export interface SearchSignal {
  term: string;
  
  // Observed evidence
  videoCount: number;
  totalViews: number;
  medianViews: number;
  
  // Recency
  recentVideos: number; // Last 30 days
  
  // Top example
  topVideo: YouTubeVideo;
  
  // Provenance
  source: 'calculated';
  evidence: string; // How this signal was detected
}

export interface TopicSaturation {
  // Video volume
  totalVideos: number;
  recentVideos: number; // Last 30 days
  
  // Channel concentration
  uniqueChannels: number;
  topChannelDominance: number; // % of views from top 3 channels
  
  // Content freshness
  medianAgeInDays: number;
  outdatedContent: number; // Videos > 2 years old
  
  // Score
  saturationScore: number; // 0-100
  level: 'low' | 'moderate' | 'high';
  
  // Provenance
  source: 'calculated';
  reasoning: string;
}

export interface MomentumIndex {
  // Activity comparison
  recentAvgViews: number; // Last 30 days
  historicalAvgViews: number; // 30-180 days
  
  // Upload activity
  recentUploads: number;
  historicalUploads: number;
  
  // Momentum score
  momentumScore: number; // 0-100 (50 = stable, >50 = growing, <50 = declining)
  trend: 'declining' | 'stable' | 'growing' | 'surging';
  
  // Provenance
  source: 'calculated';
  reasoning: string;
}

export interface CompetitionScore {
  // Inputs
  videoCount: number;
  channelAuthority: number; // Based on subscriber counts
  viewConcentration: number; // How concentrated views are
  recentActivity: number;
  
  // Score
  competitionScore: number; // 0-100
  level: 'low' | 'moderate' | 'high';
  
  // Provenance
  source: 'calculated';
  breakdown: {
    videoCount: number;
    channelAuthority: number;
    viewConcentration: number;
    recentActivity: number;
  };
  reasoning: string;
}

export interface DifficultyScore {
  // Inputs
  competition: number;
  channelAuthority: number;
  topicSaturation: number;
  breakoutAccessibility: number;
  
  // Score
  difficultyScore: number; // 0-100
  level: 'low' | 'moderate' | 'high';
  
  // Provenance
  source: 'calculated';
  breakdown: {
    competition: number;
    channelAuthority: number;
    topicSaturation: number;
    breakoutAccessibility: number;
  };
  reasoning: string;
}

// ============================================================================
// VERIFIED SEARCH TERMS (suggestion providers only — never LLM / titles)
// ============================================================================

export interface SearchTerm {
  term: string;
  source: SearchTermSource;
  sourceId: string;
  volume: number | null;
  trend: number | null;
  competition: number | null;
  retrievedAt: string;
}

export interface ResearchSources {
  id: SearchTermSource;
  label: string;
  ok: boolean;
  termCount: number;
  retrievedAt: string;
}

// ============================================================================
// AI ANALYSIS (unused by the research engine — kept for existing UI empty states)
// ============================================================================

export interface TopicCluster {
  // Cluster identification
  name: string;
  description: string;
  
  // Evidence (REAL videos)
  videos: YouTubeVideo[];
  videoCount: number;
  
  // Performance
  totalViews: number;
  medianViews: number;
  avgEngagementRate: number;
  
  // Recency
  recentActivity: number; // Videos in last 30 days
  mostRecentVideo: YouTubeVideo;
  
  // Best performer
  bestVideo: YouTubeVideo;
  
  // Provenance
  source: 'ai-analysis';
  evidence: string[]; // How AI identified this cluster
  analyzedAt: string; // ISO date
}

export interface ContentGap {
  // Gap identification
  gap: string; // What's missing or underserved
  description: string;
  
  // Evidence from research
  evidence: {
    oversaturated: string[]; // Topics heavily covered
    undersaturated: string[]; // Topics lightly covered
    outdated: string[]; // Old content needing refresh
    videoExamples: YouTubeVideo[]; // Supporting evidence
  };
  
  // Opportunity context
  opportunityReasoning: string;
  estimatedDifficulty: 'low' | 'moderate' | 'high';
  
  // Provenance
  source: 'ai-analysis';
  analyzedAt: string; // ISO date
}

export interface TitlePattern {
  // Pattern identification
  pattern: string; // e.g., "How X Works", "The Truth About X"
  
  // Observed in real videos
  examples: YouTubeVideo[];
  occurrences: number;
  
  // Performance
  medianViews: number;
  bestPerformer: YouTubeVideo;
  
  // Usage
  recentUsage: number; // Last 30 days
  
  // Provenance
  source: 'ai-analysis';
  analyzedAt: string; // ISO date
}

// ============================================================================
// TOPIC DISCOVERY (Deterministic — derived from verified research data only)
// ============================================================================

/**
 * The editorial angle that best fits a discovered topic.
 * Assigned only when the underlying evidence genuinely supports it.
 */
export type TopicAngle =
  | 'why'
  | 'how'
  | 'what'
  | 'who'
  | 'comparison'
  | 'story'
  | 'numbers'
  | 'mystery'
  | 'controversy'
  | 'failure'
  | 'rise'
  | 'fall'
  | 'explainer'
  | 'timeline'
  | 'transformation'
  | 'curiosity'
  | 'contrarian'
  | 'investigation'
  | 'general';

/**
 * A single verified signal supporting a topic candidate.
 * Every signal is traceable back to a real provider.
 */
export interface ResearchSignal {
  id: string;
  /** Human-readable value — e.g. the search term itself */
  value: string;
  /** Semantic type of the signal */
  type:
    | 'search_term'       // from YouTube/Google autocomplete or user query
    | 'trend_query'       // from Google Trends YouTube property
    | 'rising_query'      // trend query with relativeVolume >= 70
    | 'video_title_word'  // a word recurring across multiple real video titles (not extracted as a keyword)
    | 'breakout_signal';  // a topic cluster around a breakout video
  source: SearchTermSource | 'youtube-data' | 'calculated';
  sourceId: string;
  /** Google Trends relativeVolume (0–100) or null */
  volume: number | null;
  /** Google Trends trend score (0–100) or null */
  trend: number | null;
  retrievedAt: string;
}

/**
 * A discovered topic candidate.
 * Built deterministically from verified research signals — never AI-invented.
 */
export interface TopicCandidate {
  id: string;
  /** Short readable label for the topic (derived from the strongest signal, not invented) */
  topic: string;
  /** The editorial angle that fits this candidate's evidence */
  angle: TopicAngle;
  /** Human-readable explanation of how this candidate was found */
  discoveryReason: string;
  /** All verified signals that produced this candidate */
  supportingSignals: ResearchSignal[];
  /** Real YouTube videos that corroborate this topic */
  relatedVideos: YouTubeVideo[];
  /**
   * Evidence score: deterministic, based only on:
   *   - number of independent source types present
   *   - whether Google Trends data is available (relativeVolume)
   *   - whether multiple autocomplete providers agree
   *   - whether real YouTube videos match
   * Range 0–100. Formula is documented in topic-discovery.ts.
   */
  evidenceScore: number;
  /** The query that produced the research session this candidate came from */
  sourceQuery: string;
  createdAt: string;
}

/**
 * The full output of the discovery engine for a research session.
 */
export interface DiscoveredTopics {
  /** Direct sub-topics of the user's query */
  direct: TopicCandidate[];
  /** Related subjects strongly connected to the query */
  related: TopicCandidate[];
  /** Topics showing rising trend signals */
  emerging: TopicCandidate[];
  /** All candidates combined, sorted by evidenceScore desc */
  all: TopicCandidate[];
  /** The query this discovery was based on */
  sourceQuery: string;
  discoveredAt: string;
  /** How many verified signals fed the engine */
  totalSignals: number;
}

// ============================================================================
// AI GENERATED (New content creation)
// ============================================================================

export interface ContentOpportunity {
  // Opportunity
  title: string; // AI-generated title concept
  angle: string; // Content approach
  
  // Research context (evidence)
  researchContext: {
    relatedCluster?: TopicCluster;
    contentGap?: ContentGap;
    breakoutVideos: BreakoutVideo[];
    topVideos: YouTubeVideo[];
  };
  
  // Reasoning
  reasoning: string;
  evidence: string; // Specific data points supporting this
  
  // Scores
  opportunityScore: number; // 0-100
  competitionLevel: 'low' | 'moderate' | 'high';
  difficultyScore: number; // 0-100
  
  // Score breakdown (transparent)
  scoreBreakdown: {
    topicRelevance: number;
    performanceSignal: number;
    breakoutEvidence: number;
    contentGap: number;
    recentMomentum: number;
    competition: number;
    saturation: number;
  };
  
  // Suggested execution
  suggestedLength: string; // e.g., "8-12 minutes"
  contentHooks: string[]; // Key points to cover
  
  // Provenance
  source: 'ai-generated';
  generatedAt: string; // ISO date
}

export interface GeneratedTitle {
  // Title
  title: string;
  angle: string;
  
  // Context
  basedOn: {
    query: string;
    cluster?: TopicCluster;
    gap?: ContentGap;
    pattern?: TitlePattern;
  };
  
  // Reasoning
  reasoning: string;
  
  // Estimated performance
  estimatedDifficulty: number; // 0-100
  competitionLevel: 'low' | 'moderate' | 'high';
  
  // Provenance
  source: 'ai-generated';
  generatedAt: string; // ISO date
}

// ============================================================================
// REAL SEARCH DATA (from YouTube autocomplete — source: youtube-data)
// ============================================================================

export interface SearchSuggestion {
  query:      string;           // Exact autocomplete string from YouTube
  source:     'youtube-data';
  seedQuery:  string;
}

export interface RealOpportunity {
  rank: number;
  searchQuery: string;
  source: SearchTermSource;
  sourceId: string;
  retrievedAt: string;
  opportunityScore: number;
  volumeScore: number;
  competitionScore: number;
  engagementScore: number;
  competitionLevel: 'low' | 'moderate' | 'high';
  videoMatches: number;
  totalMatchViews: number;
  avgEngagementRate: number;
  scoreBreakdown: {
    volume: number;
    competition: number;
    engagement: number;
    formula: string;
  };
}

export interface RealTitle {
  rank: number;
  title: string;
  rawQuery: string;
  source: SearchTermSource;
  sourceId: string;
  retrievedAt: string;
  opportunityScore: number;
  volumeScore: number;
  competitionScore: number;
  engagementScore: number;
  competitionLevel: 'low' | 'moderate' | 'high';
}

// ============================================================================
// RESEARCH SESSION (Complete research package)
// ============================================================================

export interface ResearchSession {
  // Session identification
  id: string;
  query: string;
  normalizedQuery: string;
  createdAt: string; // ISO date
  
  // YouTube Data (from API)
  youtubeData: {
    searchResult: YouTubeSearchResult;
    retrievedAt: string; // ISO date
    cacheExpiry?: string; // ISO date
  };
  
  // Calculated Metrics
  metrics: {
    videoMetrics: VideoMetrics[];
    channelMetrics: ChannelMetrics[];
    breakouts: BreakoutVideo[];
    searchSignals: SearchSignal[];
    saturation: TopicSaturation;
    momentum: MomentumIndex;
    competition: CompetitionScore;
    difficulty: DifficultyScore;
    calculatedAt: string; // ISO date
  } | null;
  
  // AI Analysis
  analysis: {
    topics: TopicCluster[];
    gaps: ContentGap[];
    patterns: TitlePattern[];
    analyzedAt: string; // ISO date
  } | null;

  // Topic Discovery (deterministic — no AI generation)
  discoveredTopics: DiscoveredTopics | null;

  searchTerms: SearchTerm[];
  searchSources: ResearchSources[];

  // Real Search Intelligence (suggestion providers only — NOT AI)
  searchIntelligence: {
    suggestions:   SearchSuggestion[];
    opportunities: RealOpportunity[];
    titles:        RealTitle[];
    searchTerms:   SearchTerm[];
    sources:       ResearchSources[];
    fetchedAt:     string;
  } | null;

  // Legacy AI Generated (kept for type compatibility — replaced by searchIntelligence)
  generated: {
    opportunities: ContentOpportunity[];
    titles: GeneratedTitle[];
    generatedAt: string;
  } | null;
  
  // Status
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

export interface ResearchRequest {
  query: string;
  videoLimit?: number;
  channelLimit?: number;
  useCache?: boolean;
}

export interface ResearchResponse {
  session: ResearchSession;
  dataLabels: {
    youtubeData: 'YouTube Data';
    metrics: 'Calculated';
    analysis: 'AI Analysis';
    generated: 'AI Generated';
  };
}

// ============================================================================
// CONFIGURATION TYPES
// ============================================================================

export interface ScoringWeights {
  opportunityScore: {
    topicRelevance: number;
    performanceSignal: number;
    breakoutEvidence: number;
    contentGap: number;
    recentMomentum: number;
    competition: number;
    saturation: number;
  };
  
  competitionScore: {
    videoCount: number;
    channelAuthority: number;
    viewConcentration: number;
    recentActivity: number;
  };
  
  difficultyScore: {
    competition: number;
    channelAuthority: number;
    topicSaturation: number;
    breakoutAccessibility: number;
  };
}

export interface BreakoutThresholds {
  below: number;      // < 1x
  normal: number;     // 1-2x
  strong: number;     // 2-5x
  breakout: number;   // 5-10x
  major: number;      // 10x+
}

export interface CacheConfig {
  searchResultsTTL: number; // seconds
  videoMetadataTTL: number; // seconds
  channelMetadataTTL: number; // seconds
  analysisTTL: number; // seconds
}
