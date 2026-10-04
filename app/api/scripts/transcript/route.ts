/**
 * POST /api/scripts/transcript
 *
 * Extracts the transcript from a YouTube video.
 * Uses YouTube's public timedtext endpoint — no API key needed.
 *
 * Body: { url: string }
 * Returns: { success: true, data: { videoId, title, transcript, wordCount } }
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function extractVideoId(url: string): string | null {
  // Handle all common YouTube URL formats
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,         // youtube.com/watch?v=ID
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,     // youtu.be/ID
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/, // youtube.com/embed/ID
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/, // youtube.com/shorts/ID
    /^([a-zA-Z0-9_-]{11})$/,              // bare ID
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

async function fetchVideoTitle(videoId: string): Promise<string> {
  try {
    // Use oEmbed — no API key needed
    const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
    if (!res.ok) return videoId;
    const d = await res.json();
    return d.title ?? videoId;
  } catch {
    return videoId;
  }
}

async function fetchTranscript(videoId: string): Promise<string | null> {
  // Step 1: Get the video page to find caption track list
  const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });
  if (!pageRes.ok) return null;
  const html = await pageRes.text();

  // Extract caption tracks from the ytInitialPlayerResponse embedded in the page
  const captionMatch = html.match(/"captionTracks":\s*(\[[\s\S]*?\])/);
  if (!captionMatch) return null;

  let captionTracks: Array<{ baseUrl: string; languageCode: string; kind?: string }> = [];
  try {
    captionTracks = JSON.parse(captionMatch[1]);
  } catch {
    return null;
  }

  if (!captionTracks.length) return null;

  // Prefer: English manual > English auto > any manual > any auto
  const pick =
    captionTracks.find(t => t.languageCode === 'en' && !t.kind) ||
    captionTracks.find(t => t.languageCode === 'en') ||
    captionTracks.find(t => !t.kind) ||
    captionTracks[0];

  if (!pick?.baseUrl) return null;

  // Step 2: Fetch the timed text XML
  const ttRes = await fetch(pick.baseUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  if (!ttRes.ok) return null;
  const xml = await ttRes.text();

  // Step 3: Parse XML into plain text
  // Format: <text start="0.0" dur="1.5">word or phrase</text>
  const textMatches = xml.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g);
  const lines: string[] = [];
  for (const m of textMatches) {
    // Decode HTML entities and clean up
    let line = m[1]
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/<[^>]+>/g, '') // strip any inner tags
      .trim();
    if (line) lines.push(line);
  }

  if (!lines.length) return null;

  // Join into paragraphs — group every ~10 lines
  const paragraphs: string[] = [];
  for (let i = 0; i < lines.length; i += 10) {
    paragraphs.push(lines.slice(i, i + 10).join(' '));
  }
  return paragraphs.join('\n\n');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const url: string = (body.url ?? '').trim();

    if (!url) {
      return NextResponse.json({ success: false, error: 'url is required' }, { status: 400 });
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      return NextResponse.json({ success: false, error: 'Could not extract video ID. Paste a valid YouTube URL.' }, { status: 400 });
    }

    // Run title + transcript fetch in parallel
    const [title, transcript] = await Promise.all([
      fetchVideoTitle(videoId),
      fetchTranscript(videoId),
    ]);

    if (!transcript) {
      return NextResponse.json({
        success: false,
        error: 'No transcript available for this video. The creator may have disabled captions, or this video has no auto-generated captions.',
      }, { status: 404 });
    }

    const wordCount = transcript.split(/\s+/).filter(Boolean).length;

    return NextResponse.json({
      success: true,
      data: {
        videoId,
        title,
        transcript,
        wordCount,
        url: `https://www.youtube.com/watch?v=${videoId}`,
      },
    });
  } catch (error) {
    console.error('[transcript]', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch transcript. Try a different video.',
    }, { status: 500 });
  }
}
