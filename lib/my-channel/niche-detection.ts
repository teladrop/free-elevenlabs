/**
 * Niche Detection Engine
 *
 * Analyzes channel metadata to detect the creator's niche/category.
 * Uses:
 * 1. Channel title + description keywords
 * 2. YouTube category tag (if available)
 * 3. Top 5 video titles
 *
 * Returns a detected niche string (e.g., "Tech Reviews", "Gaming", "Finance")
 * with a confidence score.
 */

import { ChannelConnection, ChannelVideo } from '@/app/providers/channel-provider';

export interface NicheDetectionResult {
  niche: string;
  confidence: number; // 0-1
  sources: string[]; // what led to this detection
}

// ─── Niche Keywords ──────────────────────────────────────────────────────────

const NICHE_KEYWORDS: Record<string, string[]> = {
  'Tech Reviews': [
    'tech', 'gadget', 'review', 'unboxing', 'phone', 'laptop', 'computer',
    'electronics', 'product review', 'technology', 'device', 'specs',
  ],
  'Gaming': [
    'gaming', 'game', 'gameplay', 'twitch', 'esports', 'streamer', 'fps',
    'roblox', 'minecraft', 'gta', 'call of duty', 'fortnite', 'speedrun',
  ],
  'Finance': [
    'finance', 'stock', 'crypto', 'trading', 'bitcoin', 'investment', 'money',
    'portfolio', 'wealth', 'entrepreneur', 'business', 'financial',
  ],
  'Fitness': [
    'fitness', 'workout', 'gym', 'exercise', 'training', 'bodybuilding',
    'yoga', 'weight loss', 'diet', 'nutrition', 'health',
  ],
  'Cooking': [
    'cooking', 'recipe', 'food', 'chef', 'kitchen', 'baking', 'cuisine',
    'meal prep', 'restaurant', 'culinary',
  ],
  'Music': [
    'music', 'song', 'artist', 'album', 'guitar', 'piano', 'producer',
    'beatmaker', 'rapper', 'singer', 'cover',
  ],
  'Education': [
    'tutorial', 'learn', 'course', 'education', 'teaching', 'lecture',
    'class', 'school', 'study', 'how to', 'guide',
  ],
  'Comedy': [
    'comedy', 'funny', 'humor', 'comedian', 'joke', 'sketch', 'skit',
    'stand up', 'roast',
  ],
  'Vlogging': [
    'vlog', 'vlogging', 'daily', 'routine', 'lifestyle', 'day in my life',
    'adventure', 'travel', 'life',
  ],
  'Beauty': [
    'beauty', 'makeup', 'skincare', 'cosmetics', 'tutorial', 'hair',
    'fashion', 'style', 'appearance',
  ],
  'News & Commentary': [
    'news', 'commentary', 'reaction', 'analysis', 'current events', 'politics',
    'opinion', 'discussion',
  ],
  'DIY & Crafts': [
    'diy', 'craft', 'woodworking', 'build', 'project', 'handmade', 'maker',
    'upcycle', 'renovation',
  ],
  'Sports': [
    'sports', 'football', 'basketball', 'soccer', 'baseball', 'tennis',
    'athlete', 'coaching', 'training', 'match',
  ],
};

// ─── YouTube Category Tags (from YouTube API) ────────────────────────────────

const YOUTUBE_CATEGORY_TO_NICHE: Record<string, string> = {
  '10': 'Music',
  '15': 'Pets',
  '17': 'Sports',
  '18': 'Short Movies',
  '19': 'Travel & Events',
  '20': 'Gaming',
  '21': 'Videoblogging',
  '22': 'People & Blogs',
  '23': 'Comedy',
  '24': 'Entertainment',
  '25': 'News & Politics',
  '26': 'Howto & Style',
  '27': 'Education',
  '28': 'Science & Technology',
  '29': 'Nonprofits & Activism',
};

// ─── Niche Detection ─────────────────────────────────────────────────────────

export function detectNiche(
  connection: ChannelConnection,
  videos: ChannelVideo[],
  categoryTag?: string,
): NicheDetectionResult {
  const scores: Record<string, { score: number; sources: string[] }> = {};

  // Initialize niche scores
  Object.keys(NICHE_KEYWORDS).forEach((niche) => {
    scores[niche] = { score: 0, sources: [] };
  });

  // 1. Channel title analysis
  const titleLower = connection.channel_title.toLowerCase();
  analyzeText(titleLower, scores, 'Channel title');

  // 2. Channel description analysis
  const descriptionLower = connection.channel_description.toLowerCase();
  analyzeText(descriptionLower, scores, 'Channel description');

  // 3. YouTube category tag
  if (categoryTag) {
    const mappedNiche = YOUTUBE_CATEGORY_TO_NICHE[categoryTag];
    if (mappedNiche && scores[mappedNiche]) {
      scores[mappedNiche].score += 3; // High weight for category tag
      scores[mappedNiche].sources.push(`YouTube category: ${mappedNiche}`);
    }
  }

  // 4. Top 5 video titles
  const topVideos = videos.slice(0, 5);
  topVideos.forEach((video, idx) => {
    const titleLower = video.title.toLowerCase();
    const weight = 0.5 * (5 - idx); // Earlier videos weighted more
    analyzeTextWithWeight(titleLower, scores, `Top video ${idx + 1}`, weight);
  });

  // 5. Find the highest-scoring niche
  let topNiche = 'General Content';
  let topScore = 0;
  let topSources: string[] = [];

  Object.entries(scores).forEach(([niche, { score, sources }]) => {
    if (score > topScore) {
      topScore = score;
      topNiche = niche;
      topSources = sources;
    }
  });

  // Normalize confidence (0-1)
  // Max possible score: 3 (title) + 3 (description) + 3 (category) + 2.5 (5 videos) = 11.5
  const maxScore = 11.5;
  const confidence = Math.min(topScore / maxScore, 1);

  // If confidence is very low, we're not sure
  if (confidence < 0.3) {
    topNiche = 'General Content';
  }

  return {
    niche: topNiche,
    confidence,
    sources: topSources,
  };
}

// ─── Helper: Analyze text for keyword matches ────────────────────────────────

function analyzeText(
  text: string,
  scores: Record<string, { score: number; sources: string[] }>,
  source: string,
): void {
  analyzeTextWithWeight(text, scores, source, 1);
}

function analyzeTextWithWeight(
  text: string,
  scores: Record<string, { score: number; sources: string[] }>,
  source: string,
  weight: number = 1,
): void {
  Object.entries(NICHE_KEYWORDS).forEach(([niche, keywords]) => {
    keywords.forEach((keyword) => {
      // Match whole words or common phrases
      const patterns = [
        new RegExp(`\\b${keyword}\\b`, 'gi'), // whole word
        new RegExp(keyword, 'gi'), // substring
      ];

      let matched = false;
      for (const pattern of patterns) {
        if (pattern.test(text)) {
          scores[niche].score += weight;
          if (!matched) {
            scores[niche].sources.push(`${source}: "${keyword}"`);
            matched = true;
          }
          break;
        }
      }
    });
  });
}

// ─── Get Search Query from Niche ──────────────────────────────────────────────

export function getNicheSearchQuery(niche: string): string {
  const queries: Record<string, string> = {
    'Tech Reviews': 'tech reviews gadget channel',
    'Gaming': 'gaming channel gameplay',
    'Finance': 'finance investing crypto trading',
    'Fitness': 'fitness workout gym training',
    'Cooking': 'cooking recipe food channel',
    'Music': 'music producer artist music channel',
    'Education': 'tutorial educational channel learning',
    'Comedy': 'comedy funny channel comedian',
    'Vlogging': 'vlogging daily vlog lifestyle',
    'Beauty': 'beauty makeup skincare channel',
    'News & Commentary': 'news commentary analysis current events',
    'DIY & Crafts': 'diy craft build project channel',
    'Sports': 'sports channel coaching training',
    'General Content': 'content creator channel',
  };

  return queries[niche] || 'youtube channel';
}
