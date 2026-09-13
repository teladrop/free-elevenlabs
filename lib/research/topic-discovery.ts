/**
 * Topic Discovery Engine
 *
 * Builds TopicCandidate[] from verified research data ONLY.
 * ─────────────────────────────────────────────────────────
 * Sources used (all already collected by the research pipeline):
 *   1. SearchTerm[] from YouTube autocomplete, Google autocomplete, user query
 *   2. SearchTerm[] enriched with Google Trends relativeVolume/trend
 *   3. YouTubeVideo[] from the YouTube Data API
 *   4. BreakoutVideo[] calculated from the YouTube result set
 *   5. MomentumIndex calculated from the YouTube result set
 *
 * What this engine NEVER does:
 *   ✗ Call an LLM
 *   ✗ Invent search terms, volumes, or difficulty scores
 *   ✗ Extract nouns from YouTube video titles and treat them as keywords
 *   ✗ Use hardcoded niche logic (no "if query contains IKEA" branches)
 *   ✗ Fill predefined title templates
 *   ✗ Produce fake metrics
 *
 * Evidence score formula (documented inline at scoreCandidate):
 *   sources       × 25   (how many independent provider types agree)
 *   volumeBoost   × 20   (Google Trends signal present and non-zero)
 *   risingBoost   × 20   (Trends relativeVolume ≥ 70)
 *   videoBoost    × 20   (at least one real YouTube video corroborates)
 *   multiBoost    × 15   (≥ 3 supporting signals from different sourceIds)
 *   — capped at 100
 */

import type {
  ResearchSignal,
  TopicCandidate,
  TopicAngle,
  DiscoveredTopics,
  SearchTerm,
  SearchTermSource,
  YouTubeVideo,
  BreakoutVideo,
  MomentumIndex,
} from '@/lib/types/research';

// ─── Angle classification patterns ───────────────────────────────────────────
// Each entry is a list of token patterns.
// Matching is word-boundary-aware: a pattern matches when it appears
//   (a) at the very start of the term, or
//   (b) immediately after a space.
// This prevents "how" matching "somehow", "why" matching "subway", etc.
// Order matters: first match wins.
// These classify — they do NOT generate topics.

const ANGLE_PATTERNS: Array<{ angle: TopicAngle; patterns: string[] }> = [
  // ── Comparison ────────────────────────────────────────────────────────────
  {
    angle: 'comparison',
    patterns: [
      ' vs ', 'vs ', ' versus ', ' compared to ', ' comparison',
      ' better than', ' worse than', ' difference between', ' or ',
    ],
  },
  // ── Why ──────────────────────────────────────────────────────────────────
  {
    angle: 'why',
    patterns: [
      'why ', 'reason ', 'reasons ', 'cause ', 'causes ',
      'because ', 'explains why', 'behind why',
    ],
  },
  // ── How ──────────────────────────────────────────────────────────────────
  {
    angle: 'how',
    patterns: [
      'how ', 'tutorial', 'guide', 'step by step',
      'tips ', 'tricks', 'hacks', 'learn to', 'how-to',
    ],
  },
  // ── What ─────────────────────────────────────────────────────────────────
  {
    angle: 'what',
    patterns: [
      'what ', 'which ', 'where ', 'when ',   // broad question words
    ],
  },
  // ── Who ──────────────────────────────────────────────────────────────────
  {
    angle: 'who',
    patterns: [
      'who ', 'founder', 'founders', 'owner ', 'owners', 'ceo ',
      'creator ', 'creators', 'invented by', 'created by',
    ],
  },
  // ── Numbers ──────────────────────────────────────────────────────────────
  {
    angle: 'numbers',
    patterns: [
      // digit-led: "5 things", "10 reasons", "3 ways"
      '1 ', '2 ', '3 ', '4 ', '5 ', '6 ', '7 ', '8 ', '9 ', '10 ',
      '15 ', '20 ', '25 ', '30 ', '50 ', '100 ',
      'top ', 'number one', '#1', 'biggest', 'largest', 'smallest',
      'fastest', 'richest', 'most popular', 'ranked', 'best ',
    ],
  },
  // ── Mystery ───────────────────────────────────────────────────────────────
  {
    angle: 'mystery',
    patterns: [
      'secret', 'mystery', 'hidden', 'untold', 'nobody knows',
      'unknown', 'conspiracy', 'strange', 'weird', 'bizarre', 'unexplained',
    ],
  },
  // ── Controversy ──────────────────────────────────────────────────────────
  {
    angle: 'controversy',
    patterns: [
      'controversy', 'controversial', 'debate', 'backlash', 'banned',
      'sued', 'illegal', 'exposed', 'truth about', 'dark side', 'real reason',
    ],
  },
  // ── Failure ───────────────────────────────────────────────────────────────
  {
    angle: 'failure',
    patterns: [
      'fail', 'failed', 'failure', 'collapse', 'bankrupt', 'scandal',
      'disaster', 'worst ', 'problem', 'issue', 'mistake', 'scam', 'fraud',
    ],
  },
  // ── Rise ─────────────────────────────────────────────────────────────────
  {
    angle: 'rise',
    patterns: [
      'rise ', 'success', 'growth', 'became', 'how it started',
      'origin', 'founded', 'billion', 'empire', 'dominate', 'takeover',
    ],
  },
  // ── Fall ─────────────────────────────────────────────────────────────────
  {
    angle: 'fall',
    patterns: [
      'fall ', 'decline', 'dying', 'dead ', 'end of', 'shutting down',
      'losing', 'struggle',
    ],
  },
  // ── Story ─────────────────────────────────────────────────────────────────
  {
    angle: 'story',
    patterns: [
      'story', 'history', 'documentary', 'biography', 'life of',
      'career', 'journey', 'timeline',
    ],
  },
  // ── Transformation ───────────────────────────────────────────────────────
  {
    angle: 'transformation',
    patterns: [
      'changed', 'transform', 'evolution', 'before and after',
      'used to', 'no longer', 'revolution',
    ],
  },
  // ── Investigation ────────────────────────────────────────────────────────
  {
    angle: 'investigation',
    patterns: [
      'inside ', 'behind ', 'leaked', 'uncovered', 'investigation',
      'report', 'analysis', 'deep dive',
    ],
  },
  // ── Explainer ────────────────────────────────────────────────────────────
  {
    angle: 'explainer',
    patterns: [
      'explained', 'meaning', 'definition', 'basics',
      'introduction to', 'beginner',
    ],
  },
  // ── Curiosity ────────────────────────────────────────────────────────────
  {
    angle: 'curiosity',
    patterns: [
      'did you know', 'facts', 'interesting', 'surprising',
      'amazing', 'incredible', 'shocking', 'actually',
    ],
  },
  // ── Contrarian ───────────────────────────────────────────────────────────
  {
    angle: 'contrarian',
    patterns: [
      'wrong about', 'myth', 'overrated', 'underrated',
      'unpopular opinion', 'nobody talks about', 'not what you think',
    ],
  },
];

/**
 * Returns true when `pattern` appears in `text` at a word boundary:
 *   - at position 0 (start of string), or
 *   - preceded by a space.
 * This prevents "how" matching "somehow", "why" matching "subway", etc.
 */
function wordBoundaryMatch(text: string, pattern: string): boolean {
  const idx = text.indexOf(pattern);
  if (idx === -1) return false;
  if (idx === 0) return true;
  return text[idx - 1] === ' ';
}

/**
 * Classify the angle of a search term based purely on its text.
 * Returns 'general' if no pattern matches.
 */
function classifyAngle(term: string): TopicAngle {
  const lower = term.toLowerCase();
  for (const { angle, patterns } of ANGLE_PATTERNS) {
    if (patterns.some(p => wordBoundaryMatch(lower, p))) return angle;
  }
  return 'general';
}

// ─── Evidence scoring ─────────────────────────────────────────────────────────

/**
 * Score a candidate deterministically.
 *
 * Formula (max 100):
 *   sourceTypesScore = min(uniqueProviderTypes, 4) / 4  × 25
 *     unique provider types = how many of {user_query, youtube_autocomplete,
 *       google_autocomplete, google_trends} are represented in signals
 *   volumeScore      = signals.some(s => s.volume != null && s.volume > 0) ? 20 : 0
 *   risingScore      = signals.some(s => (s.trend ?? 0) >= 70)             ? 20 : 0
 *   videoScore       = relatedVideos.length >= 1                            ? 20 : 0
 *   multiScore       = uniqueSourceIds >= 3                                 ? 15 : 0
 */
function scoreCandidate(
  signals: ResearchSignal[],
  relatedVideos: YouTubeVideo[],
): number {
  const providerTypes = new Set(signals.map(s => s.source));
  const sourceTypesScore = Math.min(providerTypes.size, 4) / 4 * 25;

  const volumeScore = signals.some(s => s.volume != null && s.volume > 0) ? 20 : 0;
  const risingScore = signals.some(s => (s.trend ?? 0) >= 70) ? 20 : 0;
  const videoScore  = relatedVideos.length >= 1 ? 20 : 0;

  const uniqueSourceIds = new Set(signals.map(s => s.sourceId)).size;
  const multiScore  = uniqueSourceIds >= 3 ? 15 : 0;

  return Math.min(100, Math.round(sourceTypesScore + volumeScore + risingScore + videoScore + multiScore));
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeSignalId(term: string, source: string): string {
  return `${source}:${term.toLowerCase().replace(/\s+/g, '_')}`;
}

/**
 * Convert a SearchTerm into a ResearchSignal.
 * Type is 'rising_query' when the Trends relative volume is ≥ 70.
 */
function termToSignal(t: SearchTerm): ResearchSignal {
  const isRising = t.trend != null && t.trend >= 70;
  const isFromTrends = t.source === 'google_trends';
  const type = isRising
    ? 'rising_query'
    : isFromTrends
    ? 'trend_query'
    : 'search_term';

  return {
    id:          makeSignalId(t.term, t.source),
    value:       t.term,
    type,
    source:      t.source,
    sourceId:    t.sourceId,
    volume:      t.volume,
    trend:       t.trend,
    retrievedAt: t.retrievedAt,
  };
}

/**
 * Find videos whose titles contain the term (case-insensitive, whole-word-ish).
 * We use simple substring matching on normalised text.
 * This is evidence correlation — NOT turning titles into keywords.
 */
function matchingVideos(term: string, videos: YouTubeVideo[]): YouTubeVideo[] {
  const needle = term.toLowerCase().trim();
  if (needle.length < 2) return [];
  return videos
    .filter(v => v.title.toLowerCase().includes(needle))
    .slice(0, 5); // cap at 5 evidence videos per candidate
}

/**
 * Deduplicate candidates: if two share their normalised topic label,
 * keep the one with the higher evidenceScore and merge their signals.
 */
function deduplicateCandidates(candidates: TopicCandidate[]): TopicCandidate[] {
  const map = new Map<string, TopicCandidate>();

  for (const c of candidates) {
    const key = c.topic.toLowerCase().trim();
    const existing = map.get(key);
    if (!existing) {
      map.set(key, c);
      continue;
    }
    // Merge: combine signals (deduplicate by id), pick higher score
    const mergedSignals = [
      ...existing.supportingSignals,
      ...c.supportingSignals.filter(
        s => !existing.supportingSignals.some(e => e.id === s.id),
      ),
    ];
    const mergedVideos = [
      ...existing.relatedVideos,
      ...c.relatedVideos.filter(v => !existing.relatedVideos.some(e => e.videoId === v.videoId)),
    ].slice(0, 5);
    const mergedScore = scoreCandidate(mergedSignals, mergedVideos);

    map.set(key, {
      ...existing,
      supportingSignals: mergedSignals,
      relatedVideos:     mergedVideos,
      evidenceScore:     mergedScore,
    });
  }

  return Array.from(map.values());
}

/**
 * Build a human-readable discovery reason for a candidate.
 * Uses only the signal metadata — no AI, no invented prose.
 */
function buildDiscoveryReason(
  signals: ResearchSignal[],
  relatedVideos: YouTubeVideo[],
): string {
  const parts: string[] = [];

  const providers = new Set(signals.map(s => s.source));
  const providerLabels: Record<string, string> = {
    user_query:           'user query',
    youtube_autocomplete: 'YouTube autocomplete',
    google_autocomplete:  'Google autocomplete',
    google_trends:        'Google Trends',
    'youtube-data':       'YouTube data',
    calculated:           'calculated metrics',
  };
  const providerNames = [...providers].map(p => providerLabels[p] ?? p).join(', ');
  parts.push(`Appeared in ${providerNames}`);

  const rising = signals.find(s => s.type === 'rising_query');
  if (rising) {
    parts.push(`rising trend signal (relative interest: ${rising.trend})`);
  } else {
    const trendy = signals.find(s => s.volume != null && s.volume > 0);
    if (trendy) {
      parts.push(`Google Trends interest score: ${trendy.volume}`);
    }
  }

  if (relatedVideos.length > 0) {
    parts.push(`${relatedVideos.length} matching YouTube video${relatedVideos.length > 1 ? 's' : ''}`);
  }

  const uniqueSeedCount = new Set(signals.map(s => s.sourceId)).size;
  if (uniqueSeedCount >= 3) {
    parts.push(`confirmed across ${uniqueSeedCount} independent search seeds`);
  }

  return parts.join(' · ');
}

// ─── Breakout signal injection ────────────────────────────────────────────────

/**
 * Convert a BreakoutVideo into a ResearchSignal.
 * The "value" is the video's channel title (a real entity) — not an invented keyword.
 * Type = 'breakout_signal' so the UI can display it with its own badge.
 */
function breakoutToSignal(b: BreakoutVideo): ResearchSignal {
  return {
    id:          `breakout:${b.video.videoId}`,
    value:       b.video.channelTitle,
    type:        'breakout_signal',
    source:      'calculated',
    sourceId:    b.video.videoId,
    volume:      null,
    trend:       null,
    retrievedAt: b.calculatedAt,
  };
}

// ─── Main discovery function ─────────────────────────────────────────────────

export interface DiscoveryInput {
  query:       string;
  searchTerms: SearchTerm[];
  videos:      YouTubeVideo[];
  breakouts?:  BreakoutVideo[];
  momentum?:   MomentumIndex | null;
}

/**
 * discoverTopics
 *
 * Pure function — deterministic, synchronous, no I/O.
 * Takes verified research data already in the session and derives TopicCandidates.
 *
 * Algorithm:
 *   1. Convert each SearchTerm to a ResearchSignal (preserves source + provenance).
 *   2. For each signal, classify its angle from the term text.
 *   3. Find corroborating YouTube videos by substring matching the term in video titles.
 *   4. Score deterministically using the formula documented above.
 *   5. Filter out candidates with evidenceScore < MIN_SCORE.
 *   6. Deduplicate by normalised topic label.
 *   7. Classify into direct / related / emerging buckets.
 *   8. Sort each bucket by evidenceScore desc.
 *
 * MIN_SCORE = 20 (requires at least one independent source type + something else).
 * Zero topics returned is valid — the tab will show the "no discoveries" empty state.
 */
export function discoverTopics(input: DiscoveryInput): DiscoveredTopics {
  const { query, searchTerms, videos, breakouts = [], momentum = null } = input;
  const discoveredAt = new Date().toISOString();
  const MIN_SCORE = 20;

  // ── Step 1: build signals from verified terms ──────────────────────────────
  const signals: ResearchSignal[] = searchTerms.map(termToSignal);

  // ── Step 2: build one candidate per signal ─────────────────────────────────
  const rawCandidates: TopicCandidate[] = signals.map((signal, idx) => {
    // All signals that share the same normalised term value are merged later.
    // Here each signal produces exactly one provisional candidate.
    const angle     = classifyAngle(signal.value);
    const relVideos = matchingVideos(signal.value, videos);
    const score     = scoreCandidate([signal], relVideos);

    return {
      id:               `td_${idx}_${signal.id}`,
      topic:            signal.value,           // exact verified term — NOT invented
      angle,
      discoveryReason:  buildDiscoveryReason([signal], relVideos),
      supportingSignals:[signal],
      relatedVideos:    relVideos,
      evidenceScore:    score,
      sourceQuery:      query,
      createdAt:        discoveredAt,
    };
  });

  // ── Step 3: deduplicate & merge ─────────────────────────────────────────────
  let candidates = deduplicateCandidates(rawCandidates);

  // Re-derive reasons and scores after merging
  candidates = candidates.map(c => ({
    ...c,
    evidenceScore:   scoreCandidate(c.supportingSignals, c.relatedVideos),
    discoveryReason: buildDiscoveryReason(c.supportingSignals, c.relatedVideos),
  }));

  // ── Step 4: filter weak candidates ─────────────────────────────────────────
  candidates = candidates.filter(c => c.evidenceScore >= MIN_SCORE);

  // ── Step 5: inject breakout signals as additional candidates ───────────────
  // Each distinct channel that has a breakout video becomes a signal.
  // We group by channelTitle (a real entity name) and create a candidate only
  // if the channel appears in ≥ 1 breakout and the channel title differs from
  // the main query (to avoid duplicate of the user's own search).
  const breakoutByChannel = new Map<string, BreakoutVideo[]>();
  for (const b of breakouts) {
    const ch = b.video.channelTitle;
    if (!breakoutByChannel.has(ch)) breakoutByChannel.set(ch, []);
    breakoutByChannel.get(ch)!.push(b);
  }
  const queryNorm = query.toLowerCase().trim();

  for (const [channelTitle, bvids] of breakoutByChannel.entries()) {
    if (channelTitle.toLowerCase().trim() === queryNorm) continue;
    // Only add if the channel title is not already a candidate
    if (candidates.some(c => c.topic.toLowerCase() === channelTitle.toLowerCase())) continue;

    const bSignals = bvids.map(breakoutToSignal);
    const bVideos  = bvids.map(b => b.video).slice(0, 5);
    const score    = scoreCandidate(bSignals, bVideos);
    if (score < MIN_SCORE) continue;

    candidates.push({
      id:               `breakout_${channelTitle.replace(/\s+/g, '_')}`,
      topic:            channelTitle,
      angle:            'story',     // breakout channels have a story worth telling
      discoveryReason:  `Breakout channel: ${bvids.length} video${bvids.length > 1 ? 's' : ''} significantly outperformed subscriber count (${bvids.map(b => b.label).join(', ')})`,
      supportingSignals: bSignals,
      relatedVideos:    bVideos,
      evidenceScore:    score,
      sourceQuery:      query,
      createdAt:        discoveredAt,
    });
  }

  // ── Step 6: sort all candidates ─────────────────────────────────────────────
  candidates.sort((a, b) => b.evidenceScore - a.evidenceScore);

  // ── Step 7: bucket into direct / related / emerging ────────────────────────
  // direct   = candidates where the term is a direct extension of the query
  //            (term starts with or contains the query as a word)
  // emerging = candidates with a rising_query signal (Trends ≥ 70)
  // related  = everything else
  const queryTokens = queryNorm.split(/\s+/).filter(Boolean);

  function isDirect(c: TopicCandidate): boolean {
    const t = c.topic.toLowerCase();
    // Direct: term starts with or contains all query tokens
    return queryTokens.every(tok => t.includes(tok));
  }

  function isEmerging(c: TopicCandidate): boolean {
    return c.supportingSignals.some(s => s.type === 'rising_query');
  }

  // Momentum override: if session shows surging momentum, promote top-scoring
  // candidates into emerging if they aren't already direct
  const isSurging = momentum?.trend === 'surging';

  const direct:   TopicCandidate[] = [];
  const emerging: TopicCandidate[] = [];
  const related:  TopicCandidate[] = [];

  for (const c of candidates) {
    if (isDirect(c)) {
      direct.push(c);
    } else if (isEmerging(c) || (isSurging && c.evidenceScore >= 60)) {
      emerging.push(c);
    } else {
      related.push(c);
    }
  }

  // Cap buckets: no artificial limit, but don't bury weak results — only include where score >= threshold
  // (already filtered above at MIN_SCORE = 20; buckets inherit that filter)

  return {
    direct,
    related,
    emerging,
    all:          candidates,
    sourceQuery:  query,
    discoveredAt,
    totalSignals: signals.length,
  };
}
