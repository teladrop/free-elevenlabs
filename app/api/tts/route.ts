import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { text, voice = 'en_US_1' } = await request.json();
    if (!text?.trim()) {
      return NextResponse.json({ error: 'Missing text' }, { status: 400 });
    }

    console.log(`📝 TTS Request: text=${text.slice(0, 50)}... voice=${voice}`);

    // Use GTTS (Google Text-to-Speech) via simple HTTP API - completely free forever
    try {
      console.log(`🎵 Using Google TTS (free, no API key, lifetime free)...`);
      
      const encodedText = encodeURIComponent(text);
      
      // Map voices to different Google TTS accents/speeds/parameters
      const voiceParams: Record<string, { tl: string; rate?: number }> = {
        'en_US_1': { tl: 'en' },
        'en_US_2': { tl: 'en' },
        'en_US_3': { tl: 'en' },
        'en_US_4': { tl: 'en' },
        'en_US_5': { tl: 'en' },
        'en_US_6': { tl: 'en' },
        'en_US_7': { tl: 'en' },
        'en_US_8': { tl: 'en' },
        'en_US_9': { tl: 'en' },
        'en_US_10': { tl: 'en' },
        'en_GB_1': { tl: 'en-gb' },
        'en_GB_2': { tl: 'en-gb' },
        'en_GB_3': { tl: 'en-gb' },
        'en_GB_4': { tl: 'en-gb' },
        'en_GB_5': { tl: 'en-gb' },
        'en_GB_6': { tl: 'en-gb' },
        'en_AU_1': { tl: 'en-au' },
        'en_AU_2': { tl: 'en-au' },
        'en_AU_3': { tl: 'en-au' },
        'en_IN_1': { tl: 'en-in' },
        'en_IN_2': { tl: 'en-in' },
        'en_IN_3': { tl: 'en-in' },
        'en_CA_1': { tl: 'en-ca' },
        'en_CA_2': { tl: 'en-ca' },
        'en_NZ_1': { tl: 'en-nz' },
        'en_NZ_2': { tl: 'en-nz' },
      };

      const params = voiceParams[voice] || { tl: 'en' };
      
      const response = await fetch(
        `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodedText}&tl=${params.tl}&client=tw-ob`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        }
      );

      if (response.ok) {
        const audioBuffer = await response.arrayBuffer();
        console.log('✅ Got audio from Google TTS:', audioBuffer.byteLength, 'bytes');
        
        return new Response(audioBuffer, {
          headers: {
            'Content-Type': 'audio/mpeg',
            'Content-Length': audioBuffer.byteLength.toString(),
            'Cache-Control': 'public, max-age=3600',
          },
        });
      } else {
        console.warn('⚠️ Google TTS failed:', response.status);
      }
    } catch (googleError) {
      console.warn('⚠️ Google TTS error:', googleError instanceof Error ? googleError.message : 'Unknown');
    }

    return NextResponse.json(
      { error: 'TTS service unavailable.' },
      { status: 503 }
    );
  } catch (error) {
    console.error('❌ API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
