/**
 * POST /api/my-channel/analyze
 *
 * Sends the user's channel metrics + their added competitors to the AI.
 * Returns structured growth suggestions.
 *
 * Results are cached in channel_ai_suggestions for 7 days.
 * Cache is invalidated when the user adds/removes a competitor or syncs.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getUserFromRequest } from '@/lib/db/auth-server';
import { getDefaultProvider } from '@/lib/ai/provider';
import crypto from 'crypto';

export const dynamic    = 'force-dynamic';
export const maxDuration = 60;

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = db();

  // Load user's channel connection
  const { data: connection } = await supabase
    .from('user_youtube_connections')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (!connection) {
    return NextResponse.json({ error: 'No YouTube channel connected' }, { status: 404 });
  }

  // Load user's synced videos (for engagement calculation)
  const { data: videos } = await supabase
    .from('user_channel_videos')
    .select('view_count, like_count, comment_count, published_at, title')
    .eq('connection_id', connection.id)
    .limit(50);

  // Load competitors
  const { data: competitors } = await supabase
    .from('competitor_channels')
    .select('*')
    .eq('user_id', user.id)
    .order('subscriber_count', { ascending: false });

  if (!competitors || competitors.length === 0) {
    return NextResponse.json(
      { error: 'Add at least one competitor channel before running analysis.' },
      { status: 400 },
    );
  }

  // Build the prompt
  const prompt = buildAnalysisPrompt(connection, videos ?? [], competitors);
  const promptHash = crypto.createHash('sha256').update(prompt).digest('hex');

  // Check cache
  const { data: cached } = await supabase
    .from('channel_ai_suggestions')
    .select('*')
    .eq('user_id', user.id)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (cached && cached.prompt_hash === promptHash) {
    return NextResponse.json({
      success:     true,
      suggestions: cached.suggestions,
      cached:      true,
      generatedAt: cached.created_at,
    });
  }

  // Call AI
  const provider = getDefaultProvider();

  const connected = await provider.validateConnection();
  if (!connected) {
    return NextResponse.json(
      { error: 'AI service unavailable. Add GROQ_API_KEY or GEMINI_API_KEY to .env.local.' },
      { status: 503 },
    );
  }

  const response = await provider.generate(prompt, {
    task:        'analysis',
    temperature: 0.4,
    maxTokens:   2000,
  });

  // Parse JSON from AI response
  let suggestions: AISuggestion[] = [];
  try {
    const jsonMatch = response.text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      suggestions = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('No JSON array found in AI response');
    }
  } catch (err) {
    console.error('[analyze] Failed to parse AI response:', response.text, err);
    return NextResponse.json(
      { error: 'AI returned an unexpected format. Please try again.' },
      { status: 500 },
    );
  }

  // Validate shape
  suggestions = suggestions
    .filter((s) => s.title && s.description && s.action && s.impact && s.priority)
    .slice(0, 8);

  // Save to cache (upsert)
  await supabase.from('channel_ai_suggestions').upsert(
    {
      user_id:     user.id,
      suggestions,
      model_used:  response.model,
      prompt_hash: promptHash,
      created_at:  new Date().toISOString(),
      expires_at:  new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
    { onConflict: 'user_id' },
  );

  return NextResponse.json({
    success:     true,
    suggestions,
    cached:      false,
    generatedAt: new Date().toISOString(),
    model:       response.model,
  });
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface AISuggestion {
  priority:    'high' | 'medium' | 'low';
  title:       string;
  description: string;
  action:      string;
  impact:      string;
}

// ─── Prompt builder ──────────────────────────────────────────────────────────

function buildAnalysisPrompt(
  connection: any,
  videos: any[],
  competitors: any[],
): string {
  // Calculate user's own metrics
  const totalViews    = videos.reduce((s, v) => s + (v.view_count    ?? 0), 0);
  const totalLikes    = videos.reduce((s, v) => s + (v.like_count    ?? 0), 0);
  const totalComments = videos.reduce((s, v) => s + (v.comment_count ?? 0), 0);
  const videoCount    = videos.length;

  const avgViewsPerVideo  = videoCount > 0 ? Math.round(totalViews / videoCount)  : 0;
  const avgLikesPerVideo  = videoCount > 0 ? Math.round(totalLikes / videoCount)  : 0;
  const engagementRate    = totalViews > 0
    ? (((totalLikes + totalComments) / totalViews) * 100).toFixed(2)
    : '0.00';

  // Upload frequency
  let uploadFrequency = '0';
  const sortedVideos = [...videos]
    .filter((v) => v.published_at)
    .sort((a, b) => new Date(a.published_at).getTime() - new Date(b.published_at).getTime());

  if (sortedVideos.length >= 2) {
    const oldest = new Date(sortedVideos[0].published_at).getTime();
    const newest = new Date(sortedVideos[sortedVideos.length - 1].published_at).getTime();
    const months = (newest - oldest) / (1000 * 60 * 60 * 24 * 30);
    uploadFrequency = months > 0 ? (sortedVideos.length / months).toFixed(1) : '0';
  }

  // Top 5 video titles
  const topTitles = videos
    .sort((a, b) => (b.view_count ?? 0) - (a.view_count ?? 0))
    .slice(0, 5)
    .map((v, i) => `  ${i + 1}. "${v.title}" — ${(v.view_count ?? 0).toLocaleString()} views`)
    .join('\n');

  // Format competitor table
  const competitorRows = competitors
    .map((c, i) =>
      `  ${i + 1}. ${c.channel_title} (@${c.channel_handle || 'unknown'})
     Subscribers: ${(c.subscriber_count ?? 0).toLocaleString()}
     Avg engagement: ${(c.avg_engagement_rate ?? 0).toFixed(2)}%
     Avg views/video: ${Math.round(c.avg_views_per_video ?? 0).toLocaleString()}
     Upload frequency: ${(c.upload_frequency ?? 0).toFixed(1)}/month`,
    )
    .join('\n\n');

  return `You are a YouTube channel growth strategist. Analyze the following data and return ONLY a valid JSON array of growth suggestions. No markdown, no explanation — just the JSON array.

## My Channel
- Name: ${connection.channel_title}
- Subscribers: ${(connection.subscriber_count ?? 0).toLocaleString()}
- Total channel views: ${(connection.view_count ?? 0).toLocaleString()}
- Videos synced: ${videoCount}
- Avg views/video: ${avgViewsPerVideo.toLocaleString()}
- Avg likes/video: ${avgLikesPerVideo.toLocaleString()}
- Engagement rate: ${engagementRate}%
- Upload frequency: ${uploadFrequency} videos/month

## My Top 5 Videos (by views)
${topTitles || '  (No videos synced yet)'}

## My Competitors (${competitors.length} channels)
${competitorRows}

## Instructions
Compare my metrics to my competitors. Identify gaps and opportunities.
Return a JSON array with 4–6 suggestions in this exact shape:

[
  {
    "priority": "high" | "medium" | "low",
    "title": "Short title (max 8 words)",
    "description": "1–2 sentence specific comparison against my competitors, with actual numbers.",
    "action": "Concrete next step the creator can take this week.",
    "impact": "What measurable outcome to expect."
  }
]

Rules:
- Reference competitor names and real numbers in descriptions.
- Be direct and specific — no generic advice.
- Sort by priority: high first.
- Max 6 suggestions.
- Return ONLY the JSON array. Nothing else.`;
}
