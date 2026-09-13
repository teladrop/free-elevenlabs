/**
 * Maps verified suggestion-provider terms into the session shape the UI reads.
 * Ranking uses YouTube result metrics; terms are never invented.
 */

import { collectVerifiedSearches, type SearchEngineResult } from '@/lib/research/search-engine';
import { rankSearchOpportunities } from '@/lib/research/opportunity-ranker';
import type {
  SearchSuggestion,
  RealOpportunity,
  RealTitle,
  SearchTerm,
  ResearchSources,
  YouTubeVideo,
  YouTubeChannel,
} from '@/lib/types/research';

export interface SearchIntelligenceResult {
  suggestions: SearchSuggestion[];
  opportunities: RealOpportunity[];
  titles: RealTitle[];
  searchTerms: SearchTerm[];
  sources: ResearchSources[];
  fetchedAt: string;
}

export function assembleSearchIntelligence(
  collected: SearchEngineResult,
  videos: YouTubeVideo[] = [],
  channels: YouTubeChannel[] = [],
): SearchIntelligenceResult {
  const suggestions: SearchSuggestion[] = collected.searchTerms.map(t => ({
    query: t.term,
    source: 'youtube-data',
    seedQuery: t.sourceId,
  }));

  const opportunities = rankSearchOpportunities(collected.searchTerms, videos, channels);

  const titles: RealTitle[] = opportunities.map(o => ({
    rank: o.rank,
    title: o.searchQuery,
    rawQuery: o.searchQuery,
    source: o.source,
    sourceId: o.sourceId,
    retrievedAt: o.retrievedAt,
    opportunityScore: o.opportunityScore,
    volumeScore: o.volumeScore,
    competitionScore: o.competitionScore,
    engagementScore: o.engagementScore,
    competitionLevel: o.competitionLevel,
  }));

  return {
    suggestions,
    opportunities,
    titles,
    searchTerms: collected.searchTerms,
    sources: collected.sources,
    fetchedAt: collected.fetchedAt,
  };
}

export async function buildSearchIntelligence(
  query: string,
  videos: YouTubeVideo[] = [],
  channels: YouTubeChannel[] = [],
): Promise<SearchIntelligenceResult> {
  const collected = await collectVerifiedSearches(query);
  return assembleSearchIntelligence(collected, videos, channels);
}

export { SEARCH_SOURCE_LABEL } from '@/lib/types/research';
