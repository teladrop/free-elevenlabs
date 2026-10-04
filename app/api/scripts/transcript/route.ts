/**
 * POST /api/scripts/transcript
 *
 * Extracts the transcript from a YouTube video.
 * Uses YouTube's public timedtext endpoint — no API key needed.
 *
 * Strategy:
 * 1. Fetch the watch page with realistic browser headers
 * 2. Extract the serialised ytInitialPlayerResponse JSON blob
 * 3. Navigate to captionTracks inside the parsed JSON (reliable, not regex-fragile)
 * 4. Fetch the timed-text XML and convert to plain text
 *
 * Body:    { url: string }
 * Returns: { success: true, data: { videoId, title, transcript, wordCount } }
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic    = 'force-dynamic';
export const maxDuration = 30;

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractVideoId(input: string): string | null {
  const clean = input.trim();
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const p of patterns) {
    const m = clean.match(p);
    if (m) return m[1];
  }
  return null;
}

// Realistic browser headers — prevents YouTube serving a consent/bot page
const BROWSER_HEADERS = {
  'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control':   'no-cache',
  'Pragma':          'no-cache',
  'Sec-Fetch-Dest':  'document',
  'Sec-Fetch-Mode':  'navigate',
  'Sec-Fetch-Site':  'none',
  'Upgrade-Insecure-Requests': '1',
};

interface CaptionTrack {
  baseUrl: string;
  languageCode: string;
  kind?: string;        // 'asr' = auto-generated, absent = manual
  name?: { simpleText?: string };
}

/**
 * Extract the ytInitialPlayerResponse JSON blob from the page HTML.
 * YouTube embeds it as:
 *   var ytInitialPlayerResponse = {...};
 *   or window["ytInitialPlayerResponse"] = {...};
 * We find the opening brace and walk the string to find the matching close brace.
 */
function extractPlayerResponse(html: string): Record<string, unknown> | null {
  // Try both common assignment patterns
  const markers = [
    'var ytInitialPlayerResponse = ',
    'window["ytInitialPlayerResponse"] = ',
    'ytInitialPlayerResponse = ',
  ];

  for (const marker of markers) {
    const idx = html.indexOf(marker);
    if (idx === -1) continue;

    const start = html.indexOf('{', idx + marker.length);
    if (start === -1) continue;

    // Walk to find the matching closing brace
    let depth = 0;
    let i = start;
    while (i < html.length) {
      const ch = html[i];
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          const jsonStr = html.slice(start, i + 1);
          try {
            return JSON.parse(jsonStr) as Record<string, unknown>;
          } catch {
            break; // malformed — try next marker
          }
        }
      }
      i++;
    }
  }
  return null;
}

/**
 * Navigate the player response to find captionTracks.
 * Path: captions.playerCaptionsTracklistRenderer.captionTracks
 */
function getCaptionTracks(playerResponse: Record<string, unknown>): CaptionTrack[] {
  try {
    const captions = playerResponse.captions as Record<string, unknown> | undefined;
    const renderer = captions?.playerCaptionsTracklistRenderer as Record<string, unknown> | undefined;
    const tracks   = renderer?.captionTracks as CaptionTrack[] | undefined;
    return Array.isArray(tracks) ? tracks : [];
  } catch {
    return [];
  }
}

/** Pick the best available caption track — prefer English manual, then English auto, then anything */
function pickBestTrack(tracks: CaptionTrack[]): CaptionTrack | null {
  if (!tracks.length) return null;
  return (
    tracks.find(t => t.languageCode === 'en' && t.kind !== 'asr') ||  // English manual
    tracks.find(t => t.languageCode === 'en')                       ||  // English auto
    tracks.find(t => t.languageCode?.startsWith('en'))              ||  // en-GB, en-AU, etc
    tracks.find(t => t.kind !== 'asr')                              ||  // any manual
    tracks[0]                                                            // fallback
  );
}

/** Decode HTML entities in caption text */
function decodeEntities(str: string): string {
  return str
    .replace(/&amp;/g,  '&')
    .replace(/&lt;/g,   '<')
    .replace(/&gt;/g,   '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g,  "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, d) => String.fromCharCode(parseInt(d, 10)));
}

/** Convert timed-text XML to clean plain text */
function parseTimedText(xml: string): string {
  const lines: string[] = [];
  const re = /<text[^>]*>([\s\S]*?)<\/text>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const raw  = m[1];
    const text = decodeEntities(raw.replace(/<[^>]+>/g, '').replace(/\n/g, ' ')).trim();
    if (text) lines.push(text);
  }

  if (!lines.length) return '';

  // Group into sentence-like chunks (every ~8 caption segments)
  const chunks: string[] = [];
  for (let i = 0; i < lines.length; i += 8) {
    chunks.push(lines.slice(i, i + 8).join(' '));
  }
  return chunks.join('\n\n');
}

async function fetchVideoTitle(videoId: string): Promise<string> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
      { headers: { 'User-Agent': BROWSER_HEADERS['User-Agent'] } },
    );
    if (!res.ok) return videoId;
    const d = await res.json();
    return (d.title as string) ?? videoId;
  } catch {
    return videoId;
  }
}

// ── Main transcript fetcher ───────────────────────────────────────────────────

async function fetchTranscript(videoId: string): Promise<{ transcript: string; trackInfo: string } | null> {
  // Fetch the watch page
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  let html: string;
  try {
    const res = await fetch(url, { headers: BROWSER_HEADERS });
    if (!res.ok) {
      console.error(`[transcript] watch page returned ${res.status}`);
      return null;
    }
    html = await res.text();
  } catch (e) {
    console.error('[transcript] fetch error:', e);
    return null;
  }

  // Parse the player response
  const playerResponse = extractPlayerResponse(html);
  if (!playerResponse) {
    console.error('[transcript] could not extract ytInitialPlayerResponse');
    return null;
  }

  // Get caption tracks
  const tracks = getCaptionTracks(playerResponse);
  console.log(`[transcript] found ${tracks.length} caption tracks for ${videoId}`);
  if (!tracks.length) return null;

  const track = pickBestTrack(tracks);
  if (!track?.baseUrl) return null;

  const trackInfo = `${track.languageCode}${track.kind === 'asr' ? ' (auto)' : ' (manual)'}`;
  console.log(`[transcript] using track: ${trackInfo}`);

  // Fetch the timed-text XML
  // Append &fmt=json3 to get JSON instead of XML (easier to parse, more reliable)
  const ttUrl = track.baseUrl.includes('fmt=') ? track.baseUrl : `${track.baseUrl}&fmt=json3`;

  try {
    const ttRes = await fetch(ttUrl, {
      headers: { 'User-Agent': BROWSER_HEADERS['User-Agent'] },
    });

    if (!ttRes.ok) {
      console.error(`[transcript] timed-text returned ${ttRes.status}`);
      return null;
    }

    const contentType = ttRes.headers.get('content-type') ?? '';

    // json3 format returns JSON
    if (contentType.includes('json') || ttUrl.includes('fmt=json3')) {
      const json = await ttRes.json() as {
        events?: Array<{ segs?: Array<{ utf8: string }>; aAppend?: number }>;
      };
      const lines: string[] = [];
      for (const ev of json.events ?? []) {
        if (!ev.segs) continue;
        const text = ev.segs.map(s => s.utf8 ?? '').join('').replace(/\n/g, ' ').trim();
        if (text && text !== '\n') lines.push(text);
      }
      if (!lines.length) return null;
      const chunks: string[] = [];
      for (let i = 0; i < lines.length; i += 8) {
        chunks.push(lines.slice(i, i + 8).join(' '));
      }
      return { transcript: chunks.join('\n\n'), trackInfo };
    }

    // Fall back to XML parsing
    const xml = await ttRes.text();
    const transcript = parseTimedText(xml);
    if (!transcript) return null;
    return { transcript, trackInfo };

  } catch (e) {
    console.error('[transcript] timed-text fetch error:', e);
    return null;
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const urlInput: string = (body.url ?? '').trim();

    if (!urlInput) {
      return NextResponse.json({ success: false, error: 'url is required' }, { status: 400 });
    }

    const videoId = extractVideoId(urlInput);
    if (!videoId) {
      return NextResponse.json(
        { success: false, error: 'Could not extract a video ID. Paste a full YouTube URL like https://youtube.com/watch?v=...' },
        { status: 400 },
      );
    }

    const [titleResult, transcriptResult] = await Promise.all([
      fetchVideoTitle(videoId),
      fetchTranscript(videoId),
    ]);

    if (!transcriptResult) {
      return NextResponse.json(
        {
          success: false,
          error: 'No captions found for this video. This can happen if: (1) the video has no captions, (2) captions are community-contributed only, or (3) the video is age-restricted. Try a different video.',
        },
        { status: 404 },
      );
    }

    const { transcript, trackInfo } = transcriptResult;
    const wordCount = transcript.split(/\s+/).filter(Boolean).length;

    return NextResponse.json({
      success: true,
      data: {
        videoId,
        title:      titleResult,
        transcript,
        wordCount,
        trackInfo,
        url: `https://www.youtube.com/watch?v=${videoId}`,
      },
    });

  } catch (error) {
    console.error('[transcript] unexpected error:', error);
    return NextResponse.json(
      { success: false, error: 'Unexpected error fetching transcript. Please try again.' },
      { status: 500 },
    );
  }
}
