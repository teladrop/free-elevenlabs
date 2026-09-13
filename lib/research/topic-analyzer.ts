/**
 * Topic / Niche Analyzer
 *
 * Calls the AI analysis model with real YouTube video data to produce:
 *   - TopicCluster[]   – coherent sub-topics found in the niche
 *   - ContentGap[]     – under-served angles a new creator could target
 *   - TitlePattern[]   – winning structural templates visible in the data
 *
 * Nothing here touches the search-term engine or the TTS/voice pipeline.
 */

import { getDefaultProvider } from '@/lib/ai/provider';
import { buildTopicAnalysisPrompt } from '@/lib/ai/prompts';
import type {
  YouTubeVideo,
  TopicCluster,
  ContentGap,
  TitlePattern,
} from '@/lib/types/research';

// ─── Internal shapes returned by the AI ──────────────────────────────────────

interface RawCluster {
  name: string;
  description: string;
  videoIndexes: number[];
  evidence: string[];
}

interface RawGap {
  gap: string;
  description: string;
  opportunityReasoning: string;
  estimatedDifficulty: 'low' | 'moderate' | 'high';
  oversaturated: string[];
  undersaturated: string[];
  outdated: string[];
}

interface RawPattern {
  pattern: string;
  description: string;
  videoIndexes: number[];
  recentUsage: number;
}

interface RawAnalysis {
  topics: RawCluster[];
  gaps: RawGap[];
  patterns: RawPattern[];
}

// ─── Public result type ───────────────────────────────────────────────────────

export interface TopicAnalysisResult {
  topics: TopicCluster[];
  gaps: ContentGap[];
  patterns: TitlePattern[];
  analyzedAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Strips <think>…</think> and markdown fences, extracts the first JSON object */
function extractJson(raw: string): string {
  // Remove reasoning blocks some models emit
  let cleaned = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  // Strip ```json … ``` fences (multi-line aware)
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
  // Find the outermost { … } — scan carefully to handle leading prose
  let depth = 0;
  let start = -1;
  let end   = -1;
  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i] === '{') {
      if (start === -1) start = i;
      depth++;
    } else if (cleaned[i] === '}') {
      depth--;
      if (depth === 0 && start !== -1) { end = i; break; }
    }
  }
  if (start === -1 || end === -1) throw new Error('No JSON object found in AI response');
  return cleaned.slice(start, end + 1);
}

/** Build a compact one-line summary for each video to pass to the prompt */
function buildVideoSummaries(videos: YouTubeVideo[]): string {
  return videos
    .map((v, i) => {
      const views    = parseInt(v.statistics?.viewCount || '0', 10).toLocaleString();
      const age      = v.publishedAt
        ? new Date(v.publishedAt).toISOString().slice(0, 10)
        : 'unknown';
      const channel  = v.channelTitle || 'unknown';
      // Truncate title so the prompt stays within token budget
      const title    = v.title.slice(0, 90);
      return `${i}. ${title} | ${views} views | ${channel} | ${age}`;
    })
    .join('\n');
}

/** Map raw AI clusters → TopicCluster[], attaching real YouTubeVideo objects */
function buildTopicClusters(
  rawTopics: RawCluster[],
  videos: YouTubeVideo[],
  analyzedAt: string,
): TopicCluster[] {
  return rawTopics
    .filter(t => Array.isArray(t.videoIndexes) && t.videoIndexes.length >= 2)
    .map(t => {
      const clusterVideos = t.videoIndexes
        .map(idx => videos[idx])
        .filter(Boolean) as YouTubeVideo[];

      const viewCounts = clusterVideos.map(v => parseInt(v.statistics?.viewCount || '0', 10));
      viewCounts.sort((a, b) => a - b);

      const totalViews   = viewCounts.reduce((s, n) => s + n, 0);
      const medianViews  = viewCounts.length
        ? viewCounts[Math.floor(viewCounts.length / 2)]
        : 0;

      const sorted        = [...clusterVideos].sort(
        (a, b) =>
          parseInt(b.statistics?.viewCount || '0', 10) -
          parseInt(a.statistics?.viewCount || '0', 10),
      );
      const bestVideo     = sorted[0] ?? clusterVideos[0];

      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const recentActivity = clusterVideos.filter(
        v => new Date(v.publishedAt).getTime() > thirtyDaysAgo,
      ).length;

      const byDate   = [...clusterVideos].sort(
        (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
      );
      const mostRecent = byDate[0] ?? clusterVideos[0];

      return {
        name:               t.name,
        description:        t.description,
        videos:             clusterVideos,
        videoCount:         clusterVideos.length,
        totalViews,
        medianViews,
        avgEngagementRate:  0, // engagement data not always available
        recentActivity,
        mostRecentVideo:    mostRecent,
        bestVideo,
        source:             'ai-analysis' as const,
        evidence:           t.evidence ?? [],
        analyzedAt,
      } satisfies TopicCluster;
    });
}

/** Map raw AI gaps → ContentGap[] */
function buildContentGaps(rawGaps: RawGap[], videos: YouTubeVideo[], analyzedAt: string): ContentGap[] {
  return rawGaps.map(g => ({
    gap:         g.gap,
    description: g.description,
    evidence: {
      oversaturated:  g.oversaturated  ?? [],
      undersaturated: g.undersaturated ?? [],
      outdated:       g.outdated       ?? [],
      videoExamples:  videos.slice(0, 3), // attach a few representative videos
    },
    opportunityReasoning:  g.opportunityReasoning,
    estimatedDifficulty:   g.estimatedDifficulty ?? 'moderate',
    source:                'ai-analysis' as const,
    analyzedAt,
  } satisfies ContentGap));
}

/** Map raw AI patterns → TitlePattern[], attaching real YouTubeVideo objects */
function buildTitlePatterns(
  rawPatterns: RawPattern[],
  videos: YouTubeVideo[],
  analyzedAt: string,
): TitlePattern[] {
  return rawPatterns
    .filter(p => Array.isArray(p.videoIndexes) && p.videoIndexes.length >= 1)
    .map(p => {
      const exampleVideos = p.videoIndexes
        .map(idx => videos[idx])
        .filter(Boolean) as YouTubeVideo[];

      const viewCounts = exampleVideos.map(v => parseInt(v.statistics?.viewCount || '0', 10));
      viewCounts.sort((a, b) => a - b);
      const medianViews = viewCounts.length
        ? viewCounts[Math.floor(viewCounts.length / 2)]
        : 0;

      const bestPerformer = [...exampleVideos].sort(
        (a, b) =>
          parseInt(b.statistics?.viewCount || '0', 10) -
          parseInt(a.statistics?.viewCount || '0', 10),
      )[0] ?? exampleVideos[0];

      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const recentUsage   = exampleVideos.filter(
        v => new Date(v.publishedAt).getTime() > thirtyDaysAgo,
      ).length;

      return {
        pattern:       p.pattern,
        examples:      exampleVideos,
        occurrences:   p.videoIndexes.length,
        medianViews,
        bestPerformer,
        recentUsage:   p.recentUsage ?? recentUsage,
        source:        'ai-analysis' as const,
        analyzedAt,
      } satisfies TitlePattern;
    });
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * analyzeTopics
 *
 * Given the niche query string and the list of real YouTube videos already
 * fetched by the research pipeline, asks the AI to cluster them and identify
 * gaps + title patterns.
 *
 * Returns null if the AI call fails (so the research route can still return
 * a partial response rather than a hard 500).
 */
export async function analyzeTopics(
  niche: string,
  videos: YouTubeVideo[],
): Promise<TopicAnalysisResult | null> {
  if (videos.length < 3) {
    console.warn('[TopicAnalyzer] Not enough videos to analyse (<3), skipping.');
    return null;
  }

  const analyzedAt      = new Date().toISOString();
  const videoSummaries  = buildVideoSummaries(videos);
  const prompt          = buildTopicAnalysisPrompt(niche, videoSummaries, videos.length);

  const provider = getDefaultProvider();

  let rawText: string;
  try {
    const result = await provider.generate(prompt, {
      task:        'analysis',
      temperature: 0.3,   // lower temp → more deterministic JSON
      maxTokens:   3000,
    });
    rawText = result.text;
    console.log(`[TopicAnalyzer] AI responded (${rawText.length} chars), model: ${result.model}`);
  } catch (err: any) {
    console.error('[TopicAnalyzer] AI call failed:', err.message);
    return null;
  }

  let parsed: RawAnalysis;
  try {
    const jsonStr = extractJson(rawText);
    parsed = JSON.parse(jsonStr) as RawAnalysis;
  } catch (err: any) {
    console.error('[TopicAnalyzer] Failed to parse AI JSON:', err.message);
    // Log first 800 chars so you can see what the model actually returned
    console.error('[TopicAnalyzer] Raw AI output (first 800 chars):\n', rawText.slice(0, 800));
    return null;
  }

  const topics   = buildTopicClusters(parsed.topics   ?? [], videos, analyzedAt);
  const gaps     = buildContentGaps(parsed.gaps       ?? [], videos, analyzedAt);
  const patterns = buildTitlePatterns(parsed.patterns ?? [], videos, analyzedAt);

  console.log(
    `[TopicAnalyzer] ✓ ${topics.length} clusters, ${gaps.length} gaps, ${patterns.length} patterns`,
  );

  return { topics, gaps, patterns, analyzedAt };
}
