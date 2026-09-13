/**
 * YouTube Research search-term engine.
 *
 * Only verified searches from connected suggestion providers.
 * Never uses an LLM. Never turns video titles into keywords.
 */

import {
  fetchVerifiedSuggestions,
  sanitizeSearchText,
  isVerifiedSearchTerm,
} from '@/lib/youtube/autocomplete';
import { fetchYoutubeTrendKeywords } from '@/lib/research/google-trends';
import type { SearchTerm, SearchTermSource, ResearchSources } from '@/lib/types/research';

export interface SearchEngineResult {
  userQuery: string;
  normalizedQuery: string;
  searchTerms: SearchTerm[];
  sources: ResearchSources[];
  fetchedAt: string;
}

function asSearchTerm(
  term: string,
  source: SearchTermSource,
  sourceId: string,
  retrievedAt: string,
  volume: number | null = null,
  trend: number | null = null,
): SearchTerm {
  return {
    term,
    source,
    sourceId,
    volume,
    trend,
    competition: null,
    retrievedAt,
  };
}

export async function collectVerifiedSearches(userQuery: string): Promise<SearchEngineResult> {
  const fetchedAt = new Date().toISOString();
  const normalizedQuery = sanitizeSearchText(userQuery);

  const sources: ResearchSources[] = [];
  const terms: SearchTerm[] = [];
  const seen = new Set<string>();

  if (isVerifiedSearchTerm(normalizedQuery)) {
    const userTerm = asSearchTerm(normalizedQuery, 'user_query', 'user', fetchedAt);
    terms.push(userTerm);
    seen.add(normalizedQuery.toLowerCase());
    sources.push({
      id: 'user_query',
      label: 'User query',
      ok: true,
      termCount: 1,
      retrievedAt: fetchedAt,
    });
  }

  let suggestions: Awaited<ReturnType<typeof fetchVerifiedSuggestions>> = [];
  try {
    suggestions = await fetchVerifiedSuggestions(normalizedQuery, 40);
  } catch (err) {
    console.warn('[SearchEngine] suggestion providers failed:', err);
    suggestions = [];
  }

  const ytCount = suggestions.filter(s => s.source === 'youtube_autocomplete').length;
  const gCount = suggestions.filter(s => s.source === 'google_autocomplete').length;

  sources.push({
    id: 'youtube_autocomplete',
    label: 'YouTube search suggestions',
    ok: ytCount > 0,
    termCount: ytCount,
    retrievedAt: fetchedAt,
  });
  sources.push({
    id: 'google_autocomplete',
    label: 'Google search suggestions',
    ok: gCount > 0,
    termCount: gCount,
    retrievedAt: fetchedAt,
  });

  for (const s of suggestions) {
    const key = s.term.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    terms.push(asSearchTerm(s.term, s.source, s.sourceId, s.retrievedAt));
  }

  let trendKeywords: Awaited<ReturnType<typeof fetchYoutubeTrendKeywords>> = [];
  try {
    trendKeywords = await fetchYoutubeTrendKeywords(normalizedQuery);
  } catch (err) {
    console.warn('[SearchEngine] Google Trends failed:', err);
    trendKeywords = [];
  }

  sources.push({
    id: 'google_trends',
    label: 'Google Trends (YouTube search)',
    ok: trendKeywords.length > 0,
    termCount: trendKeywords.length,
    retrievedAt: fetchedAt,
  });

  for (const t of trendKeywords) {
    const key = t.term.toLowerCase();
    const existing = terms.find(x => x.term.toLowerCase() === key);
    if (existing) {
      existing.volume = t.relativeVolume;
      existing.trend = t.relativeVolume;
      continue;
    }
    seen.add(key);
    terms.push(asSearchTerm(t.term, 'google_trends', t.sourceId, t.retrievedAt, t.relativeVolume, t.relativeVolume));
  }

  return {
    userQuery,
    normalizedQuery,
    searchTerms: terms,
    sources,
    fetchedAt,
  };
}
