/**
 * YouTube Research API
 *
 * 1. Verified searches from suggestion providers (never LLM)
 * 2. YouTube Data API search for the user query
 * 3. Metrics calculated from those YouTube results
 */

import { NextRequest, NextResponse } from 'next/server';
import type { ResearchSession, ResearchResponse } from '@/lib/types/research';
import { API_LIMITS } from '@/lib/config/research';
import { comprehensiveSearch } from '@/lib/youtube/data-service';
import { normalizeQuery, isValidQuery } from '@/lib/youtube/normalizer';
import {
  calculateAllVideoMetrics,
  identifyBreakoutVideos,
  calculateChannelMetrics,
  extractSearchSignals,
  calculateTopicSaturation,
  calculateMomentumIndex,
  calculateCompetitionScore,
  calculateDifficultyScore,
} from '@/lib/research/metrics-engine';
import { collectVerifiedSearches } from '@/lib/research/search-engine';
import { assembleSearchIntelligence } from '@/lib/research/search-intelligence';
import { analyzeTopics } from '@/lib/research/topic-analyzer';
import { discoverTopics } from '@/lib/research/topic-discovery';

export const maxDuration = 180;

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const {
      query,
      videoLimit   = 25,
      channelLimit = API_LIMITS.defaultChannelLimit,
      useCache     = true,
    } = body;

    if (!query || !isValidQuery(query)) {
      return NextResponse.json({ error: 'Invalid search query' }, { status: 400 });
    }

    const normalizedQuery = normalizeQuery(query);
    const sessionId = `research_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    console.log(`\n${'='.repeat(70)}`);
    console.log(`[Research] Session: ${sessionId}`);
    console.log(`[Research] Query:   "${normalizedQuery}"`);
    console.log(`${'='.repeat(70)}\n`);

    console.log('[Research] 1/3 Fetching verified searches…');
    let collectedSearches: Awaited<ReturnType<typeof collectVerifiedSearches>> | null = null;
    try {
      collectedSearches = await collectVerifiedSearches(normalizedQuery);
      console.log(`[Research] ✓ ${collectedSearches.searchTerms.length} verified searches`);
    } catch (err: any) {
      console.warn('[Research] Suggestion providers failed:', err.message);
    }

    console.log('[Research] 2/3 Fetching YouTube data…');
    let youtubeData;
    try {
      youtubeData = await comprehensiveSearch(
        normalizedQuery,
        videoLimit,
        channelLimit,
        useCache,
      );
      console.log(`[Research] ✓ ${youtubeData.videos.length} videos, ${youtubeData.channels.length} channels`);
    } catch (err: any) {
      if (err.message?.includes('quota')) {
        const searchIntelligence = collectedSearches
          ? assembleSearchIntelligence(collectedSearches, [], [])
          : null;
        return NextResponse.json(
          {
            session: {
              id: sessionId,
              query,
              normalizedQuery,
              createdAt: new Date().toISOString(),
              youtubeData: {
                searchResult: {
                  query: normalizedQuery,
                  videos: [],
                  channels: [],
                  totalResults: 0,
                  retrievedAt: new Date().toISOString(),
                  source: 'youtube-data',
                },
                retrievedAt: new Date().toISOString(),
              },
              metrics: null,
              analysis: null,
              discoveredTopics: null,
              searchTerms: collectedSearches?.searchTerms ?? [],
              searchSources: collectedSearches?.sources ?? [],
              searchIntelligence,
              generated: null,
              status: 'completed',
              error: err.message,
            },
            dataLabels: {
              youtubeData: 'YouTube Data',
              metrics: 'Calculated',
              analysis: 'AI Analysis',
              generated: 'AI Generated',
            },
          },
          { status: 200 },
        );
      }
      throw err;
    }

    let metrics: ResearchSession['metrics'] | null = null;

    if (youtubeData.videos.length > 0) {
      console.log('[Research] 3/3 Calculating metrics from YouTube results…');

      const channelSubMap = new Map<string, number>();
      for (const ch of youtubeData.channels) {
        channelSubMap.set(ch.channelId, parseInt(ch.statistics.subscriberCount || '0'));
      }

      const videoMetrics   = calculateAllVideoMetrics(youtubeData.videos, channelSubMap);
      const breakouts      = identifyBreakoutVideos(youtubeData.videos, channelSubMap);
      const searchSignals  = extractSearchSignals(youtubeData.videos);
      const saturation     = calculateTopicSaturation(youtubeData.videos, youtubeData.channels);
      const momentum       = calculateMomentumIndex(youtubeData.videos);
      const competition    = calculateCompetitionScore(youtubeData.videos, youtubeData.channels);
      const difficulty     = calculateDifficultyScore(competition, saturation, breakouts);

      const channelMetrics = await Promise.all(
        youtubeData.channels.slice(0, 10).map(ch => {
          const vids = youtubeData.videos.filter(v => v.channelId === ch.channelId);
          return calculateChannelMetrics(ch, vids);
        }),
      );

      metrics = {
        videoMetrics,
        channelMetrics,
        breakouts,
        searchSignals,
        saturation,
        momentum,
        competition,
        difficulty,
        calculatedAt: new Date().toISOString(),
      };
    }

    const searchIntelligence = collectedSearches
      ? assembleSearchIntelligence(
          collectedSearches,
          youtubeData.videos,
          youtubeData.channels,
        )
      : null;

    // ── Topic Discovery (deterministic — no AI, no invented data) ─────────────
    // Runs synchronously over already-collected verified data. Zero extra I/O.
    // Returns DiscoveredTopics | null. The Topics tab reads this field first.
    const discoveredTopics = (collectedSearches && collectedSearches.searchTerms.length > 0)
      ? discoverTopics({
          query:       normalizedQuery,
          searchTerms: collectedSearches.searchTerms,
          videos:      youtubeData.videos,
          breakouts:   metrics?.breakouts ?? [],
          momentum:    metrics?.momentum  ?? null,
        })
      : null;

    console.log(
      discoveredTopics
        ? `[Research] ✓ Topic discovery: ${discoveredTopics.all.length} candidates ` +
          `(${discoveredTopics.direct.length} direct, ${discoveredTopics.related.length} related, ` +
          `${discoveredTopics.emerging.length} emerging)`
        : '[Research] Topic discovery: skipped (no verified search terms)',
    );

    // ── AI topic / niche analysis ──────────────────────────────────────────
    // Runs after YouTube data + metrics are ready. Uses the 'analysis' model
    // (nex-agi/nex-n2.5-pro:free). Fails gracefully — a null result just
    // leaves the Topics tab in its "No AI analysis" empty state, same as
    // before this feature was added. Voice and search-term engine are untouched.
    let analysis: ResearchSession['analysis'] = null;
    if (youtubeData.videos.length >= 3) {
      console.log('[Research] 4/4 Running AI topic analysis…');
      try {
        const result = await analyzeTopics(normalizedQuery, youtubeData.videos);
        if (result) {
          analysis = {
            topics:      result.topics,
            gaps:        result.gaps,
            patterns:    result.patterns,
            analyzedAt:  result.analyzedAt,
          };
          console.log(
            `[Research] ✓ AI analysis: ${result.topics.length} clusters, ` +
            `${result.gaps.length} gaps, ${result.patterns.length} patterns`,
          );
        }
      } catch (err: any) {
        // Non-fatal — log and continue without analysis
        console.warn('[Research] AI topic analysis failed (non-fatal):', err.message);
      }
    }

    const session: ResearchSession = {
      id: sessionId,
      query,
      normalizedQuery,
      createdAt: new Date().toISOString(),
      youtubeData: {
        searchResult: youtubeData,
        retrievedAt:  youtubeData.retrievedAt,
      },
      metrics,
      analysis,
      discoveredTopics,
      searchTerms: collectedSearches?.searchTerms ?? [],
      searchSources: collectedSearches?.sources ?? [],
      searchIntelligence,
      generated: null,
      status: 'completed',
    };

    const response: ResearchResponse = {
      session,
      dataLabels: {
        youtubeData: 'YouTube Data',
        metrics:     'Calculated',
        analysis:    'AI Analysis',
        generated:   'AI Generated',
      },
    };

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n[Research] ✓ Completed in ${elapsed}s\n`);

    return NextResponse.json(response);

  } catch (err: any) {
    console.error('[Research] Fatal error:', err);
    return NextResponse.json(
      { error: 'Research failed', details: err.message },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  const q = new URL(request.url).searchParams.get('query');
  if (!q) return NextResponse.json({ error: 'query param required' }, { status: 400 });
  return NextResponse.json({ message: 'Use POST to start a research session', query: q });
}
