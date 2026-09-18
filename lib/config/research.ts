/**
 * YouTube Research System - Configuration
 * 
 * Transparent scoring formulas and thresholds
 * NO RANDOMNESS - every score is deterministic
 */

import type { ScoringWeights, BreakoutThresholds, CacheConfig } from '@/lib/types/research';

// ============================================================================
// SCORING WEIGHTS (Transparent formulas)
// ============================================================================

/**
 * Opportunity Score Calculation:
 * 
 * OpportunityScore = (
 *   TopicRelevance * 0.20 +
 *   PerformanceSignal * 0.20 +
 *   BreakoutEvidence * 0.15 +
 *   ContentGap * 0.15 +
 *   RecentMomentum * 0.10 +
 *   (100 - Competition) * 0.10 +
 *   (100 - Saturation) * 0.10
 * )
 * 
 * All components are 0-100 scale
 * Higher is better
 */
export const OPPORTUNITY_WEIGHTS: ScoringWeights['opportunityScore'] = {
  topicRelevance: 0.20,
  performanceSignal: 0.20,
  breakoutEvidence: 0.15,
  contentGap: 0.15,
  recentMomentum: 0.10,
  competition: 0.10,  // Inverted: (100 - competition)
  saturation: 0.10,   // Inverted: (100 - saturation)
};

/**
 * Competition Score Calculation:
 * 
 * Competition = (
 *   VideoCount * 0.25 +
 *   ChannelAuthority * 0.25 +
 *   ViewConcentration * 0.20 +
 *   RecentActivity * 0.15 +
 *   TitleSimilarity * 0.15
 * )
 * 
 * Higher = more competitive
 */
export const COMPETITION_WEIGHTS: ScoringWeights['competitionScore'] = {
  videoCount: 0.25,
  channelAuthority: 0.25,
  viewConcentration: 0.20,
  recentActivity: 0.30, // Combined recent + title similarity
};

/**
 * Difficulty Score Calculation:
 * 
 * Difficulty = (
 *   Competition * 0.35 +
 *   ChannelAuthority * 0.25 +
 *   TopicSaturation * 0.20 +
 *   (100 - BreakoutAccessibility) * 0.20
 * )
 * 
 * Higher = more difficult
 */
export const DIFFICULTY_WEIGHTS: ScoringWeights['difficultyScore'] = {
  competition: 0.35,
  channelAuthority: 0.25,
  topicSaturation: 0.20,
  breakoutAccessibility: 0.20, // Inverted: (100 - breakoutAccessibility)
};

/**
 * Verified-search opportunity rank:
 *   Score = Volume×0.40 + (100−Competition)×0.35 + Engagement×0.25
 *
 * Volume is a YouTube demand proxy (views of matching videos + suggest rank),
 * not Keyword Planner monthly volume.
 */
export const SEARCH_RANK_WEIGHTS = {
  volume: 0.40,
  competition: 0.35,
  engagement: 0.25,
} as const;

// ============================================================================
// BREAKOUT THRESHOLDS
// ============================================================================

/**
 * Breakout Ratio = Video Views / Channel Subscribers
 * 
 * Categories:
 * - Below (<1x): Video underperforming channel baseline
 * - Normal (1-2x): Expected performance
 * - Strong (2-5x): Outperforming expectations
 * - Breakout (5-10x): Significant outperformance
 * - Major (10x+): Exceptional viral breakout
 */
export const BREAKOUT_THRESHOLDS: BreakoutThresholds = {
  below: 1.0,
  normal: 2.0,
  strong: 5.0,
  breakout: 10.0,
  major: Infinity,
};

// ============================================================================
// SATURATION THRESHOLDS
// ============================================================================

/**
 * Topic Saturation Score: 0-100
 * 
 * Inputs:
 * - Total videos in niche
 * - Recent upload frequency
 * - Channel concentration
 * - Content freshness
 */
export const SATURATION_THRESHOLDS = {
  low: 40,      // 0-40: Low saturation, good opportunity
  moderate: 70, // 40-70: Moderate saturation, need differentiation
  high: 100,    // 70-100: High saturation, very competitive
};

// ============================================================================
// MOMENTUM THRESHOLDS
// ============================================================================

/**
 * Momentum Score: 0-100 (50 = stable baseline)
 * 
 * Based on:
 * - Recent vs historical average views
 * - Recent vs historical upload frequency
 */
export const MOMENTUM_THRESHOLDS = {
  declining: 35,  // 0-35: Declining interest
  stable: 65,     // 35-65: Stable interest
  growing: 85,    // 65-85: Growing interest
  surging: 100,   // 85-100: Surging interest
};

// ============================================================================
// COMPETITION THRESHOLDS
// ============================================================================

/**
 * Competition Score: 0-100
 */
export const COMPETITION_THRESHOLDS = {
  low: 40,      // 0-40: Low competition
  moderate: 70, // 40-70: Moderate competition
  high: 100,    // 70-100: High competition
};

// ============================================================================
// DIFFICULTY THRESHOLDS
// ============================================================================

/**
 * Difficulty Score: 0-100
 */
export const DIFFICULTY_THRESHOLDS = {
  low: 40,      // 0-40: Accessible for new creators
  moderate: 70, // 40-70: Requires strategy
  high: 100,    // 70-100: Very challenging
};

// ============================================================================
// CACHE CONFIGURATION
// ============================================================================

/**
 * Cache TTLs in seconds
 * 
 * Balances:
 * - YouTube API quota conservation
 * - Data freshness
 * - User experience
 */
export const CACHE_CONFIG: CacheConfig = {
  searchResultsTTL: 24 * 60 * 60,
  videoMetadataTTL: 24 * 60 * 60,
  channelMetadataTTL: 48 * 60 * 60,
  analysisTTL: 2 * 60 * 60,
};

// ============================================================================
// API LIMITS
// ============================================================================

/**
 * YouTube API request limits
 * 
 * Default free tier: 10,000 units/day
 * 
 * Cost breakdown:
 * - search.list: 100 units
 * - videos.list: 1 unit per video (can batch up to 50)
 * - channels.list: 1 unit per channel (can batch up to 50)
 */
export const API_LIMITS = {
  maxVideosPerSearch: 50,      // One search.list page (100 units) — 25 costs the same as 50
  maxChannelsPerSearch: 50,    // Extra channel search pages cost 100 units each
  defaultVideoLimit: 50,
  defaultChannelLimit: 50,     // One search.list; more channels come from video results
  batchSize: 50,               // videos.list / channels.list: 1 unit per 50 IDs
  channelSearchVariations: 1,
};

// ============================================================================
// RESEARCH PARAMETERS
// ============================================================================

/**
 * Parameters for research analysis
 */
export const RESEARCH_PARAMS = {
  // Recency windows
  recentDays: 30,        // Define "recent" as last 30 days
  historicalDays: 180,   // Historical comparison period
  
  // Video filtering
  minViews: 100,         // Minimum views to consider a video
  minDuration: 30,       // Minimum duration in seconds
  
  // Channel filtering
  minSubscribers: 100,   // Minimum subscribers to include channel
  
  // Topic clustering
  minClusterSize: 2,     // Minimum videos per topic cluster
  maxClusters: 10,       // Maximum topic clusters to generate
  
  // Content gaps
  maxGaps: 5,            // Maximum content gaps to identify
  
  // Opportunities
  maxOpportunities: 15,  // Maximum opportunities to generate
  
  // Titles
  maxTitles: 20,         // Maximum titles to generate
};

// ============================================================================
// AI MODEL CONFIGURATION
// ============================================================================

/**
 * AI models for different tasks
 */
export const AI_MODELS = {
  topicClustering: process.env.ANALYSIS_MODEL || 'nvidia/nemotron-3-super-120b-a12b:free',
  gapAnalysis: process.env.ANALYSIS_MODEL || 'nvidia/nemotron-3-super-120b-a12b:free',
  opportunityGeneration: process.env.TITLES_MODEL || 'nvidia/nemotron-3-super-120b-a12b:free',
  titleGeneration: process.env.TITLES_MODEL || 'nvidia/nemotron-3-super-120b-a12b:free',
  
  // Temperature settings
  analysisTemperature: 0.3,  // Lower for analysis (more consistent)
  generationTemperature: 0.7, // Higher for generation (more creative)
  
  // Token limits
  analysisMaxTokens: 2000,
  generationMaxTokens: 3000,
};

// ============================================================================
// SCORING HELPERS
// ============================================================================

/**
 * Normalize a score to 0-100 range
 */
export function normalizeScore(value: number, min: number = 0, max: number = 100): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

/**
 * Get label for breakout ratio
 */
export function getBreakoutLabel(ratio: number): 'below' | 'normal' | 'strong' | 'breakout' | 'major-breakout' {
  if (ratio < BREAKOUT_THRESHOLDS.below) return 'below';
  if (ratio < BREAKOUT_THRESHOLDS.normal) return 'normal';
  if (ratio < BREAKOUT_THRESHOLDS.strong) return 'strong';
  if (ratio < BREAKOUT_THRESHOLDS.breakout) return 'breakout';
  return 'major-breakout';
}

/**
 * Get label for saturation score
 */
export function getSaturationLevel(score: number): 'low' | 'moderate' | 'high' {
  if (score < SATURATION_THRESHOLDS.low) return 'low';
  if (score < SATURATION_THRESHOLDS.moderate) return 'moderate';
  return 'high';
}

/**
 * Get label for momentum score
 */
export function getMomentumTrend(score: number): 'declining' | 'stable' | 'growing' | 'surging' {
  if (score < MOMENTUM_THRESHOLDS.declining) return 'declining';
  if (score < MOMENTUM_THRESHOLDS.stable) return 'stable';
  if (score < MOMENTUM_THRESHOLDS.growing) return 'growing';
  return 'surging';
}

/**
 * Get label for competition score
 */
export function getCompetitionLevel(score: number): 'low' | 'moderate' | 'high' {
  if (score < COMPETITION_THRESHOLDS.low) return 'low';
  if (score < COMPETITION_THRESHOLDS.moderate) return 'moderate';
  return 'high';
}

/**
 * Get label for difficulty score
 */
export function getDifficultyLevel(score: number): 'low' | 'moderate' | 'high' {
  if (score < DIFFICULTY_THRESHOLDS.low) return 'low';
  if (score < DIFFICULTY_THRESHOLDS.moderate) return 'moderate';
  return 'high';
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate that all weights sum to approximately 1.0
 */
function validateWeights() {
  const opportunitySum = Object.values(OPPORTUNITY_WEIGHTS).reduce((sum, w) => sum + w, 0);
  const competitionSum = Object.values(COMPETITION_WEIGHTS).reduce((sum, w) => sum + w, 0);
  const difficultySum = Object.values(DIFFICULTY_WEIGHTS).reduce((sum, w) => sum + w, 0);
  
  if (Math.abs(opportunitySum - 1.0) > 0.01) {
    console.warn(`[CONFIG] Opportunity weights sum to ${opportunitySum}, should be 1.0`);
  }
  if (Math.abs(competitionSum - 1.0) > 0.01) {
    console.warn(`[CONFIG] Competition weights sum to ${competitionSum}, should be 1.0`);
  }
  if (Math.abs(difficultySum - 1.0) > 0.01) {
    console.warn(`[CONFIG] Difficulty weights sum to ${difficultySum}, should be 1.0`);
  }
}

// Validate on load
validateWeights();
