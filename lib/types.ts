// ─── Project Types ───────────────────────────────────────────────────────────
export interface Project {
  id: string;
  title: string;
  topic: string;
  contentType: string;
  style: string;
  targetAudience: string;
  videoLength: number;
  tone: string;
  retentionIntensity: number;
  platform: string;
  researchNotes?: string;
  selectedAngle?: string;
  script?: string;
  scriptAnalysis?: ScriptAnalysis;
  visualStyle?: string;
  visualBible?: VisualBible;
  lines?: ScriptLine[];
  voiceSettings?: VoiceSettings;
  createdAt: number;
  updatedAt: number;
  status: 'draft' | 'research' | 'scripting' | 'visual' | 'voiceover' | 'complete';
}

// ─── Script Types ───────────────────────────────────────────────────────────
export interface ScriptGenerationParams {
  topic: string;
  contentType: string;
  style: string;
  targetAudience: string;
  videoLength: number;
  tone: string;
  retentionIntensity: number;
  keyPoints?: string[];
  researchMaterial?: string;
  platform: string;
}

export interface ScriptAnalysis {
  hookStrength: number; // 0-10
  curiosity: number; // 0-10
  pacing: number; // 0-10
  narrativeProgression: number; // 0-10
  informationDensity: number; // 0-10
  repetition: number; // 0-10 (lower is better)
  predictability: number; // 0-10 (lower is better)
  openLoops: number; // count
  payoffs: number; // count
  endingStrength: number; // 0-10
  ttsReadability: number; // 0-10
  suggestions: string[];
  overallScore: number; // 0-100
}

// ─── Script Line Types ────────────────────────────────────────────────────────
export interface ScriptLine {
  id: string;
  index: number;
  text: string;
  duration?: number;
  visualPrompt?: string;
  visualStyle?: string;
  motionPrompt?: string;
  imageGenerated?: boolean;
  imageUrl?: string;
}

// ─── Visual Types ────────────────────────────────────────────────────────────
export type VisualStyle =
  | '2d-stickman'
  | '2d-minimal'
  | '2d-editorial'
  | '2d-documentary'
  | '3d-stylized'
  | '3d-educational'
  | '3d-isometric'
  | 'cinematic'
  | 'photorealistic'
  | '3d-lowpoly'
  | 'paper-cutout'
  | 'hand-drawn'
  | 'infographic'
  | 'animated-diagram'
  | 'minimal-geometric'
  | 'map-geographic'
  | 'retro';

export interface VisualBible {
  style: VisualStyle;
  colorDirection: string;
  lighting: string;
  environment: string;
  characterAppearance: string;
  characterClothing: string;
  architecture: string;
  objectAppearance: string;
  cameraLanguage: string;
  renderingStyle: string;
  levelOfRealism: string;
  composition: string;
  aspectRatio: string;
}

// ─── YouTube Research Types ──────────────────────────────────────────────────
export interface YouTubeVideoData {
  videoId: string;
  title: string;
  channelId: string;
  channelTitle: string;
  publishedAt: string;
  viewCount?: number;
  likeCount?: number;
  commentCount?: number;
  duration?: string;
  durationSeconds?: number;
  description?: string;
  thumbnail?: string;
  /** Age of video in days at time of research */
  ageDays?: number;
}

export interface ChannelData {
  channelId: string;
  title: string;
  description?: string;
  thumbnail?: string;
  subscriberCount?: number;
  totalViewCount?: number;
  videoCount?: number;
  publishedAt?: string;
  /** Avg views of the channel's most recent 5 videos in this niche */
  avgRecentViews?: number;
  /** Estimated uploads per month (last 90 days) */
  uploadsPerMonth?: number;
  /** Videos found in this niche search */
  nicheVideos: YouTubeVideoData[];
  /** AI-calculated channel performance score 0-100 */
  performanceScore: number;
  performanceBreakdown: {
    relevance: number;       // 0-20
    subscriberSize: number;  // 0-20
    recentPerformance: number; // 0-20
    avgViews: number;        // 0-20
    consistency: number;     // 0-20
  };
}

export interface KeywordIntelligence {
  keyword: string;
  /** Number of relevant videos found */
  videoCount: number;
  /** Median views of found videos */
  medianViews: number;
  /** Total views across found videos */
  totalViews: number;
  /** Average age of found videos in days */
  avgAgeDays: number;
  /** Largest channel subscriber count competing in this keyword */
  maxCompetitorSubs: number;
  /** Average subscriber count of competing channels */
  avgCompetitorSubs: number;
  /** Estimated demand signal 0-100 */
  demandSignal: number;
  /** Competition score 0-100 (higher = more competitive) */
  competition: number;
  /** Opportunity score 0-100 */
  opportunityScore: number;
  /** Suggested content angle */
  recommendedAngle: string;
  /** Is this topic trending (recent videos doing well)? */
  trending: boolean;
}

export interface TitlePattern {
  pattern: string;
  frequency: number;
  examples: string[];
  type: 'question' | 'howwhy' | 'number' | 'emotional' | 'contrarian' | 'story' | 'other';
}

export interface ContentGap {
  gap: string;
  rationale: string;
  opportunity: 'high' | 'medium' | 'low';
}

export interface VideoOpportunity {
  title: string;
  angle: string;
  hook: string;
  rationale: string;
  keywordTarget: string;
  estimatedDemand: number; // 0-10
  competitionLevel: 'low' | 'medium' | 'high';
  visualPotential: number; // 0-10
  storytellingPotential: number; // 0-10
}

export interface ResearchResult {
  topic: string;
  videoCount: number;
  channelCount: number;
  videos: YouTubeVideoData[];
  channels: ChannelData[];
  channelLeaderboard: ChannelData[]; // sorted by performanceScore desc
  keywordIntelligence: KeywordIntelligence[];
  titlePatterns: TitlePattern[];
  commonThemes: string[];
  contentGaps: ContentGap[];
  videoOpportunities: VideoOpportunity[];
  patterns: ContentPattern[]; // legacy compat
  searchedAt: string;
}

export interface ContentPattern {
  pattern: string;
  frequency: number;
  examples: string[];
}

export interface IdeaGeneration {
  topic: string;
  angle: string;
  title: string;
  description: string;
  searchability: number; // 0-10
  storytellingPotential: number; // 0-10
  visualPotential: number; // 0-10
}

// ─── Voice Settings ──────────────────────────────────────────────────────────
export interface VoiceSettings {
  voiceId: string;
  style: string;
  speed: number;
  pitch: number;
}

// ─── AI Provider Types ───────────────────────────────────────────────────────
export type AITaskType = 'script' | 'analysis' | 'titles' | 'visual' | 'ideas';

export interface AIProviderConfig {
  type: 'openrouter';
  apiKey?: string;
  baseUrl?: string;
  /** Per-task model overrides */
  models: {
    script: string;
    analysis: string;
    titles: string;
    visual: string;
    ideas: string;
    fallback: string;
  };
  siteName?: string;
  siteUrl?: string;
}

export interface AIProviderResponse {
  text: string;
  model?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// ─── API Response Types ──────────────────────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
