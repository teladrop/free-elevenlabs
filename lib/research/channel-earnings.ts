/**
 * SocialBlade / VidIQ-style YouTube earnings estimate from public Data API fields.
 *
 * YouTube does not publish revenue. This matches the public-estimator method:
 *   1. Gate on YPP eligibility (1,000 subs; watch hours are not in the API)
 *   2. Estimate monthly views from recent velocity blended with lifetime average
 *   3. Apply ad coverage (not every view is monetized)
 *   4. RPM = creator net after YouTube's ~45% cut, by niche + country + format
 *   5. earnings = (monthlyViews × adCoverage / 1000) × RPM
 */

import type { ChannelMetrics, YouTubeChannel, YouTubeVideo } from '@/lib/types/research';

export type MonetizationStatus =
  | 'likely_monetized'
  | 'not_eligible_subs'
  | 'not_eligible_volume'
  | 'kids'
  | 'unknown';

export interface NicheRpm {
  id: string;
  label: string;
  /** Creator take-home USD per 1,000 *monetized* views (after YouTube cut). */
  min: number;
  max: number;
  /** Share of views that typically carry ads. */
  adCoverage: number;
}

export interface ChannelEarningsEstimate {
  monetization: MonetizationStatus;
  monetizationLabel: string;
  eligible: boolean;
  niche: NicheRpm;
  country: string | null;
  countryMultiplier: number;
  rpmMin: number;
  rpmMax: number;
  estimatedMonthlyViews: number;
  estimatedDailyViews: number;
  adCoverage: number;
  monthlyLow: number;
  monthlyHigh: number;
  dailyLow: number;
  dailyHigh: number;
  yearlyLow: number;
  yearlyHigh: number;
  method: string;
}

const YPP_MIN_SUBS = 1000;
const YPP_MIN_VIDEOS = 10;

const NICHE_RPM: NicheRpm[] = [
  { id: 'finance', label: 'Finance / investing', min: 12, max: 32, adCoverage: 0.58 },
  { id: 'insurance', label: 'Insurance / legal', min: 14, max: 38, adCoverage: 0.6 },
  { id: 'real-estate', label: 'Real estate', min: 8, max: 22, adCoverage: 0.55 },
  { id: 'saas', label: 'Software / SaaS', min: 8, max: 22, adCoverage: 0.55 },
  { id: 'business', label: 'Business / marketing', min: 7, max: 18, adCoverage: 0.55 },
  { id: 'crypto', label: 'Crypto / web3', min: 5, max: 16, adCoverage: 0.5 },
  { id: 'tech', label: 'Tech / reviews', min: 5, max: 16, adCoverage: 0.55 },
  { id: 'auto', label: 'Autos', min: 5, max: 14, adCoverage: 0.52 },
  { id: 'health', label: 'Health / fitness', min: 4, max: 12, adCoverage: 0.5 },
  { id: 'beauty', label: 'Beauty / fashion', min: 5, max: 14, adCoverage: 0.52 },
  { id: 'education', label: 'Education', min: 3, max: 10, adCoverage: 0.5 },
  { id: 'howto', label: 'How-to / DIY', min: 3, max: 9, adCoverage: 0.5 },
  { id: 'food', label: 'Food / cooking', min: 3, max: 8, adCoverage: 0.5 },
  { id: 'travel', label: 'Travel', min: 3, max: 10, adCoverage: 0.48 },
  { id: 'news', label: 'News / commentary', min: 2, max: 8, adCoverage: 0.55 },
  { id: 'sports', label: 'Sports', min: 2, max: 7, adCoverage: 0.5 },
  { id: 'entertainment', label: 'Entertainment', min: 1.5, max: 5, adCoverage: 0.48 },
  { id: 'gaming', label: 'Gaming', min: 1.2, max: 4.5, adCoverage: 0.45 },
  { id: 'asmr', label: 'ASMR / relaxation', min: 2, max: 6, adCoverage: 0.45 },
  { id: 'music', label: 'Music', min: 0.4, max: 2.2, adCoverage: 0.35 },
  { id: 'vlog', label: 'Vlog / lifestyle', min: 2, max: 7, adCoverage: 0.48 },
  { id: 'kids', label: 'Kids / family', min: 0, max: 0.4, adCoverage: 0.08 },
  { id: 'general', label: 'General', min: 2, max: 8, adCoverage: 0.5 },
];

const NICHE_KEYWORDS: Array<{ id: string; words: string[] }> = [
  { id: 'finance', words: ['finance', 'invest', 'stock', 'trading', 'money', 'wealth', 'dividend', 'budget', 'tax', 'retirement', 'forex'] },
  { id: 'insurance', words: ['insurance', 'lawyer', 'attorney', 'legal', 'lawsuit', 'injury'] },
  { id: 'real-estate', words: ['real estate', 'realtor', 'housing', 'mortgage', 'property', 'landlord'] },
  { id: 'saas', words: ['saas', 'software', 'app review', 'productivity', 'notion', 'excel', 'coding bootcamp'] },
  { id: 'business', words: ['business', 'entrepreneur', 'marketing', 'sales', 'startup', 'dropship', 'ecommerce', 'agency'] },
  { id: 'crypto', words: ['crypto', 'bitcoin', 'nft', 'blockchain', 'web3', 'ethereum'] },
  { id: 'tech', words: ['tech', 'gadget', 'iphone', 'android', 'laptop', 'review', 'unbox', 'smartphone', 'pc build'] },
  { id: 'auto', words: ['car', 'auto', 'vehicle', 'tesla', 'mechanic', 'driving'] },
  { id: 'health', words: ['health', 'fitness', 'workout', 'gym', 'diet', 'nutrition', 'yoga', 'weight loss'] },
  { id: 'beauty', words: ['beauty', 'makeup', 'skincare', 'fashion', 'outfit', 'hair'] },
  { id: 'education', words: ['learn', 'tutorial', 'course', 'study', 'exam', 'math', 'science', 'history lesson', 'language'] },
  { id: 'howto', words: ['how to', 'diy', 'repair', 'fix', 'woodwork', 'home improvement'] },
  { id: 'food', words: ['recipe', 'cooking', 'food', 'chef', 'baking', 'mukbang'] },
  { id: 'travel', words: ['travel', 'vlog travel', 'tourism', 'hotel', 'flight'] },
  { id: 'news', words: ['news', 'politics', 'commentary', 'breaking'] },
  { id: 'sports', words: ['sport', 'football', 'soccer', 'nba', 'nfl', 'cricket', 'highlights'] },
  { id: 'gaming', words: ['game', 'gaming', 'gameplay', 'esport', 'minecraft', 'fortnite', 'roblox', 'streamer'] },
  { id: 'asmr', words: ['asmr', 'relax', 'sleep', 'meditation'] },
  { id: 'music', words: ['music', 'song', ' rap ', 'lyrics', 'cover', 'album', 'official audio', 'vevo'] },
  { id: 'entertainment', words: ['comedy', 'prank', 'reaction', 'podcast', 'movie', 'tv show', 'drama', 'entertainment'] },
  { id: 'vlog', words: ['vlog', 'daily', 'lifestyle', 'day in'] },
  { id: 'kids', words: ['kids', 'nursery', 'cocomelon', 'peppa', 'cartoon', 'for children', 'baby song', 'kids song'] },
];

const TOPIC_TO_NICHE: Array<{ match: string; id: string }> = [
  { match: 'video_game', id: 'gaming' },
  { match: 'hobby', id: 'gaming' },
  { match: 'music', id: 'music' },
  { match: 'entertainment', id: 'entertainment' },
  { match: 'film', id: 'entertainment' },
  { match: 'television', id: 'entertainment' },
  { match: 'sport', id: 'sports' },
  { match: 'association_football', id: 'sports' },
  { match: 'lifestyle', id: 'vlog' },
  { match: 'fashion', id: 'beauty' },
  { match: 'beauty', id: 'beauty' },
  { match: 'health', id: 'health' },
  { match: 'physical_fitness', id: 'health' },
  { match: 'food', id: 'food' },
  { match: 'tourism', id: 'travel' },
  { match: 'knowledge', id: 'education' },
  { match: 'technology', id: 'tech' },
  { match: 'vehicle', id: 'auto' },
  { match: 'business', id: 'business' },
  { match: 'politics', id: 'news' },
  { match: "children's_music", id: 'kids' },
];

/** Relative to a mid-tier US RPM. Unknown country uses a global blend. */
const COUNTRY_RPM: Record<string, number> = {
  US: 1.15, CA: 0.95, GB: 1.0, AU: 1.05, NZ: 0.9,
  DE: 0.92, NL: 0.88, FR: 0.82, SE: 0.95, NO: 1.02, CH: 1.1, AT: 0.9, IE: 0.95, DK: 0.95, FI: 0.88, BE: 0.85,
  JP: 0.72, KR: 0.65, SG: 0.85, HK: 0.8, TW: 0.55,
  BR: 0.35, MX: 0.32, AR: 0.28, CO: 0.3, CL: 0.38, PE: 0.28,
  IN: 0.22, PK: 0.18, BD: 0.18, PH: 0.25, ID: 0.22, VN: 0.22, TH: 0.28, MY: 0.4,
  NG: 0.2, ZA: 0.4, EG: 0.22, KE: 0.22, GH: 0.22,
  TR: 0.32, RU: 0.25, UA: 0.22, PL: 0.45, ES: 0.7, IT: 0.72, PT: 0.55, GR: 0.48,
  SA: 0.55, AE: 0.7, IL: 0.75,
};

function nicheById(id: string): NicheRpm {
  return NICHE_RPM.find((n) => n.id === id) || NICHE_RPM[NICHE_RPM.length - 1];
}

function scoreText(haystack: string, words: string[]): number {
  let score = 0;
  for (const w of words) {
    if (haystack.includes(w)) score += w.includes(' ') ? 2 : 1;
  }
  return score;
}

export function detectChannelNiche(input: {
  channel: YouTubeChannel;
  videos?: YouTubeVideo[];
  searchQuery?: string;
}): NicheRpm {
  const { channel, videos = [], searchQuery = '' } = input;
  const videoBlob = videos
    .slice(0, 8)
    .map((v) => `${v.title} ${v.description || ''}`)
    .join(' ');
  const hay = `${channel.title} ${channel.description || ''} ${videoBlob} ${searchQuery}`.toLowerCase();

  const topics = (channel.topicCategories || []).join(' ').toLowerCase();
  for (const t of TOPIC_TO_NICHE) {
    if (topics.includes(t.match)) {
      const fromTopic = nicheById(t.id);
      if (t.id === 'kids' || scoreText(hay, NICHE_KEYWORDS.find((k) => k.id === t.id)?.words || []) > 0) {
        return fromTopic;
      }
      // Topic is a hint; still let keywords override if they score higher
      let best = fromTopic;
      let bestScore = 1;
      for (const row of NICHE_KEYWORDS) {
        const s = scoreText(hay, row.words);
        if (s > bestScore) {
          bestScore = s;
          best = nicheById(row.id);
        }
      }
      return bestScore >= 1 ? best : fromTopic;
    }
  }

  let best = nicheById('general');
  let bestScore = 0;
  for (const row of NICHE_KEYWORDS) {
    const s = scoreText(hay, row.words);
    if (s > bestScore) {
      bestScore = s;
      best = nicheById(row.id);
    }
  }
  return best;
}

export function countryMultiplier(code: string | null | undefined): number {
  if (!code) return 0.7;
  return COUNTRY_RPM[code.toUpperCase()] ?? 0.7;
}

function channelInt(value: string | undefined): number {
  const n = parseInt(value || '0', 10);
  return Number.isFinite(n) ? n : 0;
}

export function detectMonetization(channel: YouTubeChannel, niche?: NicheRpm): {
  status: MonetizationStatus;
  label: string;
  eligible: boolean;
} {
  if (channel.madeForKids || niche?.id === 'kids') {
    return { status: 'kids', label: 'Kids / made-for-kids — limited ads', eligible: false };
  }
  if (channel.statistics.hiddenSubscriberCount) {
    return { status: 'unknown', label: 'Subs hidden — YPP unknown', eligible: true };
  }
  const subs = channelInt(channel.statistics.subscriberCount);
  const videoCount = channelInt(channel.statistics.videoCount);
  if (subs < YPP_MIN_SUBS) {
    return {
      status: 'not_eligible_subs',
      label: `Not YPP eligible (${subs.toLocaleString()} / 1,000 subs)`,
      eligible: false,
    };
  }
  if (videoCount > 0 && videoCount < YPP_MIN_VIDEOS) {
    return {
      status: 'not_eligible_volume',
      label: `Too few public videos for YPP (${videoCount} / 10)`,
      eligible: false,
    };
  }
  return { status: 'likely_monetized', label: 'Likely YPP eligible (1,000+ subs)', eligible: true };
}

function channelAgeDays(publishedAt: string | undefined): number {
  if (!publishedAt) return 365 * 3;
  const t = new Date(publishedAt).getTime();
  if (!Number.isFinite(t)) return 365 * 3;
  return Math.max(30, (Date.now() - t) / 86_400_000);
}

/**
 * Monthly view estimate: blend recent upload velocity with lifetime daily average.
 * Never uses totalViews / videoCount / 12 (that is not monthly views).
 */
export function estimateMonthlyViews(channel: YouTubeChannel, metrics?: ChannelMetrics | null): number {
  const ageDays = channelAgeDays(channel.publishedAt);
  const totalViews = channelInt(channel.statistics.viewCount);
  const lifetimeDaily = totalViews / ageDays;
  const lifetimeMonthly = lifetimeDaily * 30;

  const avg = metrics?.avgViewsPerVideo || 0;
  const uploadsPerMonth = metrics?.uploadFrequency || 0;
  const recentMonthly = avg > 0 && uploadsPerMonth > 0 ? avg * uploadsPerMonth : 0;

  let monthly: number;
  if (recentMonthly > 0 && (metrics?.recentUploads || 0) > 0) {
    monthly = recentMonthly * 0.7 + lifetimeMonthly * 0.3;
  } else if (recentMonthly > 0) {
    monthly = recentMonthly * 0.45 + lifetimeMonthly * 0.55;
  } else {
    monthly = lifetimeMonthly;
  }

  // Lifetime average is a ceiling for dying channels and a floor for new spikes
  if (lifetimeMonthly > 0) {
    monthly = Math.min(monthly, lifetimeMonthly * 4);
    monthly = Math.max(monthly, lifetimeMonthly * 0.15);
  }

  return Math.max(0, monthly);
}

export function estimateChannelEarnings(input: {
  channel: YouTubeChannel;
  metrics?: ChannelMetrics | null;
  searchQuery?: string;
  videos?: YouTubeVideo[];
}): ChannelEarningsEstimate {
  const { channel, metrics, searchQuery, videos } = input;
  const niche = detectChannelNiche({ channel, videos, searchQuery });
  const monetization = detectMonetization(channel, niche);
  const country = channel.country || null;
  const cMult = countryMultiplier(country);

  const shortsShare = metrics?.shortsShare ?? 0;
  const shortsMult = shortsShare >= 0.6 ? 0.4 : shortsShare >= 0.3 ? 0.7 : 1;

  const adCoverage = Math.min(0.7, Math.max(0.05, niche.adCoverage * (shortsShare >= 0.6 ? 0.85 : 1)));
  const rpmMin = niche.min * cMult * shortsMult;
  const rpmMax = niche.max * cMult * shortsMult;

  const monthlyViews = estimateMonthlyViews(channel, metrics);
  const dailyViews = monthlyViews / 30;

  const monetizedMonthly = monthlyViews * adCoverage;
  const monthlyLow = monetization.eligible ? (monetizedMonthly / 1000) * rpmMin : 0;
  const monthlyHigh = monetization.eligible ? (monetizedMonthly / 1000) * rpmMax : 0;

  const method =
    (metrics?.recentUploads || 0) > 0
      ? '70% recent uploads × avg views + 30% lifetime daily average'
      : 'Lifetime views ÷ channel age (SocialBlade-style daily average)';

  return {
    monetization: monetization.status,
    monetizationLabel: monetization.label,
    eligible: monetization.eligible,
    niche,
    country,
    countryMultiplier: cMult,
    rpmMin,
    rpmMax,
    estimatedMonthlyViews: monthlyViews,
    estimatedDailyViews: dailyViews,
    adCoverage,
    monthlyLow,
    monthlyHigh,
    dailyLow: monthlyLow / 30,
    dailyHigh: monthlyHigh / 30,
    yearlyLow: monthlyLow * 12,
    yearlyHigh: monthlyHigh * 12,
    method,
  };
}

export function formatUsdRange(low: number, high: number): string {
  const fmt = (n: number) => {
    if (n <= 0) return '$0';
    if (n < 1) return `$${n.toFixed(2)}`;
    if (n < 10) return `$${n.toFixed(1)}`;
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 10_000) return `$${Math.round(n / 1000)}K`;
    return `$${Math.round(n).toLocaleString()}`;
  };
  if (low <= 0 && high <= 0) return '$0';
  return `${fmt(low)} – ${fmt(high)}`;
}

export function formatRpm(min: number, max: number): string {
  const a = min < 1 ? min.toFixed(2) : min.toFixed(1);
  const b = max < 1 ? max.toFixed(2) : max.toFixed(1);
  return `$${a}–$${b}`;
}
