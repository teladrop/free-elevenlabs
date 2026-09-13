/**
 * Real search-suggestion providers.
 *
 * Terms come only from:
 *   - YouTube autocomplete (suggestqueries, ds=yt)
 *   - Google autocomplete (suggestqueries, client=firefox)
 *
 * Seeds are the user's query and, optionally, other terms already returned
 * by a provider. We never invent suffixes, alphabet sweeps, or templates.
 */

export type SuggestionSource = 'youtube_autocomplete' | 'google_autocomplete';

export interface RawSuggestion {
  term: string;
  source: SuggestionSource;
  sourceId: string;
  retrievedAt: string;
}

const SUGGEST_BASE = 'https://suggestqueries.google.com/complete/search';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

interface CacheEntry {
  data: string[];
  expiresAt: number;
}

const suggestCache = new Map<string, CacheEntry>();

const URL_TOKEN = /https?:\/\/|www\.|\.com\b|\.net\b|\.org\b|\.io\b|\/watch\?|\/channel\/|\/@/i;
const JUNK_TOKENS = new Set([
  'http', 'https', 'www', 'html', 'htm', 'php', 'asp', 'aspx', 'utm',
  'src', 'ref', 'clid', 'gclid', 'fbclid',
]);

function cacheGet(key: string): string[] | null {
  const entry = suggestCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    suggestCache.delete(key);
    return null;
  }
  return entry.data;
}

function cacheSet(key: string, data: string[]) {
  suggestCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

/** Strip URLs and tracking junk; collapse whitespace. Does not rewrite intent. */
export function sanitizeSearchText(input: string): string {
  if (!input || typeof input !== 'string') return '';
  let s = input.normalize('NFKC').replace(/\0/g, '');
  s = s.replace(/https?:\/\/\S+/gi, ' ');
  s = s.replace(/www\.\S+/gi, ' ');
  s = s.replace(/[?&][a-z0-9_]+=[\w.-]+/gi, ' ');
  s = s.replace(/[<>[\]{}|\\^`]/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  s = s.replace(/^[\s"'.,;:!?\-–—]+|[\s"'.,;:!?\-–—]+$/g, '');
  return s;
}

export function isVerifiedSearchTerm(term: string): boolean {
  const s = sanitizeSearchText(term);
  if (s.length < 2 || s.length > 200) return false;
  if (!/[a-zA-Z0-9]/.test(s)) return false;
  if (URL_TOKEN.test(s)) return false;

  const tokens = s.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;
  if (tokens.some(t => JUNK_TOKENS.has(t))) return false;

  for (let i = 1; i < tokens.length; i++) {
    if (tokens[i] === tokens[i - 1]) return false;
  }

  return true;
}

function parseSuggestionPayload(text: string): string[] {
  let trimmed = text.trim();
  if (!trimmed) return [];

  const jsonp = trimmed.match(/^[a-zA-Z_$][\w.$]*\(\s*([\s\S]*)\)\s*;?\s*$/);
  if (jsonp) trimmed = jsonp[1].trim();

  try {
    const jsonStart = trimmed.indexOf('[');
    if (jsonStart === -1) return [];
    const parsed = JSON.parse(trimmed.slice(jsonStart));
    if (!Array.isArray(parsed) || parsed.length < 2) return [];
    const list = parsed[1];
    if (!Array.isArray(list)) return [];

    return list
      .map((item: unknown) => {
        if (typeof item === 'string') return item;
        if (Array.isArray(item) && typeof item[0] === 'string') return item[0];
        return null;
      })
      .filter((s): s is string => typeof s === 'string' && s.trim().length > 0);
  } catch {
    return [];
  }
}

async function fetchSuggestList(url: string): Promise<string[]> {
  const cached = cacheGet(url);
  if (cached) return cached;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const terms = parseSuggestionPayload(await res.text());
    cacheSet(url, terms);
    return terms;
  } catch {
    return [];
  }
}

async function fetchYoutubeSuggest(seed: string): Promise<string[]> {
  const url = `${SUGGEST_BASE}?client=youtube&ds=yt&hl=en&q=${encodeURIComponent(seed)}`;
  return fetchSuggestList(url);
}

async function fetchGoogleSuggest(seed: string): Promise<string[]> {
  const url = `${SUGGEST_BASE}?client=firefox&hl=en&q=${encodeURIComponent(seed)}`;
  return fetchSuggestList(url);
}

function toSuggestion(
  raw: string,
  source: SuggestionSource,
  sourceId: string,
  retrievedAt: string,
): RawSuggestion | null {
  const term = sanitizeSearchText(raw);
  if (!isVerifiedSearchTerm(term)) return null;
  return { term, source, sourceId, retrievedAt };
}

/**
 * Fetch verified related searches for the user's query only.
 * Second hop uses provider-returned terms as seeds — never invented phrases.
 */
export async function fetchVerifiedSuggestions(
  userQuery: string,
  maxResults = 40,
): Promise<RawSuggestion[]> {
  const seed = sanitizeSearchText(userQuery);
  if (!isVerifiedSearchTerm(seed)) return [];

  const retrievedAt = new Date().toISOString();
  const seen = new Set<string>();
  const out: RawSuggestion[] = [];

  const pushAll = (raws: string[], source: SuggestionSource, sourceId: string) => {
    for (const raw of raws) {
      if (out.length >= maxResults) return;
      const item = toSuggestion(raw, source, sourceId, retrievedAt);
      if (!item) continue;
      const key = item.term.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    }
  };

  const [ytPrimary, gPrimary] = await Promise.all([
    fetchYoutubeSuggest(seed),
    fetchGoogleSuggest(seed),
  ]);

  pushAll(ytPrimary, 'youtube_autocomplete', seed);
  pushAll(gPrimary, 'google_autocomplete', seed);

  const hopSeeds = out.slice(0, 8).map(s => s.term);
  const BATCH = 4;
  for (let i = 0; i < hopSeeds.length && out.length < maxResults; i += BATCH) {
    const batch = hopSeeds.slice(i, i + BATCH);
    const lists = await Promise.all(
      batch.flatMap(s => [
        fetchYoutubeSuggest(s).then(list => ({ list, source: 'youtube_autocomplete' as const, sourceId: s })),
        fetchGoogleSuggest(s).then(list => ({ list, source: 'google_autocomplete' as const, sourceId: s })),
      ]),
    );
    for (const { list, source, sourceId } of lists) {
      pushAll(list, source, sourceId);
    }
  }

  console.log(`[Suggest] "${seed}" → ${out.length} verified searches`);
  return out;
}
