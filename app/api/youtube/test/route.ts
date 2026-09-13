import { NextRequest, NextResponse } from 'next/server';

/**
 * Test endpoint to verify YouTube API and system configuration
 */
export async function GET(request: NextRequest) {
  const checks: any = {
    timestamp: new Date().toISOString(),
    environment: {
      youtubeApiKey: !!process.env.YOUTUBE_API_KEY,
      openrouterApiKey: !!process.env.OPENROUTER_API_KEY,
      scriptModel: process.env.SCRIPT_MODEL,
      analysisModel: process.env.ANALYSIS_MODEL,
      titlesModel: process.env.TITLES_MODEL,
      visualModel: process.env.VISUAL_MODEL
    },
    libraries: {
      youtubeApi: 'lib/youtube/api.ts',
      youtubeMetrics: 'lib/youtube/metrics.ts',
      youtubeAnalysis: 'lib/youtube/analysis.ts',
      researchScoring: 'lib/research/scoring.ts',
      researchAiAnalysis: 'lib/research/ai-analysis.ts'
    },
    status: 'Ready for testing'
  };

  // Test YouTube API connectivity
  if (process.env.YOUTUBE_API_KEY) {
    try {
      const testUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=test&maxResults=1&key=${process.env.YOUTUBE_API_KEY}`;
      const response = await fetch(testUrl);
      
      if (response.ok) {
        checks.youtubeApiStatus = 'Connected ✅';
      } else if (response.status === 429) {
        checks.youtubeApiStatus = 'Quota Exceeded (wait until midnight PT) ⏳';
      } else {
        const error = await response.json();
        checks.youtubeApiStatus = `Error: ${error.error?.message || response.statusText}`;
      }
    } catch (error: any) {
      checks.youtubeApiStatus = `Connection failed: ${error.message}`;
    }
  } else {
    checks.youtubeApiStatus = 'YouTube API key not configured ❌';
  }

  // Test OpenRouter connectivity
  if (process.env.OPENROUTER_API_KEY) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`
        }
      });
      
      if (response.ok) {
        checks.openrouterStatus = 'Connected ✅';
      } else {
        checks.openrouterStatus = `Error: ${response.statusText}`;
      }
    } catch (error: any) {
      checks.openrouterStatus = `Connection failed: ${error.message}`;
    }
  } else {
    checks.openrouterStatus = 'OpenRouter API key not configured ❌';
  }

  return NextResponse.json(checks);
}
