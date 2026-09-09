import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { text, voice = 'en_US_1' } = await request.json();
    if (!text?.trim()) {
      return NextResponse.json({ error: 'Missing text' }, { status: 400 });
    }

    console.log(`📝 TTS Request: text=${text.slice(0, 50)}... voice=${voice}`);

    // Map voices to language variants and speaker info for Silero TTS
    const voiceMap: Record<string, { lang: string; speaker: string; gender: string }> = {
      'en_US_1': { lang: 'en', speaker: 'en_0', gender: 'female' },
      'en_US_2': { lang: 'en', speaker: 'en_1', gender: 'male' },
      'en_US_3': { lang: 'en', speaker: 'en_2', gender: 'female' },
      'en_US_4': { lang: 'en', speaker: 'en_3', gender: 'male' },
      'en_US_5': { lang: 'en', speaker: 'en_4', gender: 'female' },
      'en_US_6': { lang: 'en', speaker: 'en_5', gender: 'male' },
      'en_US_7': { lang: 'en', speaker: 'en_6', gender: 'female' },
      'en_US_8': { lang: 'en', speaker: 'en_7', gender: 'male' },
      'en_US_9': { lang: 'en', speaker: 'en_0', gender: 'female' },
      'en_US_10': { lang: 'en', speaker: 'en_1', gender: 'male' },
      'en_GB_1': { lang: 'en', speaker: 'en_2', gender: 'female' },
      'en_GB_2': { lang: 'en', speaker: 'en_3', gender: 'male' },
      'en_GB_3': { lang: 'en', speaker: 'en_4', gender: 'female' },
      'en_GB_4': { lang: 'en', speaker: 'en_5', gender: 'male' },
      'en_GB_5': { lang: 'en', speaker: 'en_6', gender: 'female' },
      'en_GB_6': { lang: 'en', speaker: 'en_7', gender: 'male' },
      'en_AU_1': { lang: 'en', speaker: 'en_0', gender: 'female' },
      'en_AU_2': { lang: 'en', speaker: 'en_1', gender: 'male' },
      'en_AU_3': { lang: 'en', speaker: 'en_2', gender: 'female' },
      'en_IN_1': { lang: 'en', speaker: 'en_3', gender: 'male' },
      'en_IN_2': { lang: 'en', speaker: 'en_4', gender: 'female' },
      'en_IN_3': { lang: 'en', speaker: 'en_5', gender: 'male' },
      'en_CA_1': { lang: 'en', speaker: 'en_6', gender: 'female' },
      'en_CA_2': { lang: 'en', speaker: 'en_7', gender: 'male' },
      'en_NZ_1': { lang: 'en', speaker: 'en_0', gender: 'female' },
      'en_NZ_2': { lang: 'en', speaker: 'en_1', gender: 'male' },
    };

    const voiceConfig = voiceMap[voice] || { lang: 'en', speaker: 'en_0', gender: 'female' };

    // Try Silero TTS API (completely free, open source, supports male/female)
    try {
      console.log(`🎵 Using Silero TTS (${voiceConfig.gender}, speaker: ${voiceConfig.speaker})...`);
      
      const response = await fetch('https://api.silero.ai/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          language: voiceConfig.lang,
          speaker: voiceConfig.speaker,
          sample_rate: 48000,
        }),
      });

      if (response.ok) {
        const audioBuffer = await response.arrayBuffer();
        console.log('✅ Got audio from Silero TTS:', audioBuffer.byteLength, 'bytes');
        
        return new Response(audioBuffer, {
          headers: {
            'Content-Type': 'audio/wav',
            'Content-Length': audioBuffer.byteLength.toString(),
            'Cache-Control': 'public, max-age=3600',
          },
        });
      } else {
        console.warn('⚠️ Silero TTS failed:', response.status);
      }
    } catch (sileroError) {
      console.warn('⚠️ Silero error:', sileroError instanceof Error ? sileroError.message : 'Unknown');
    }

    // Fallback: Google Translate TTS (single voice but free)
    try {
      console.log('🎵 Fallback: Using Google Translate TTS...');
      
      const encodedText = encodeURIComponent(text);
      const response = await fetch(
        `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodedText}&tl=en&client=tw-ob`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        }
      );

      if (response.ok) {
        const audioBuffer = await response.arrayBuffer();
        console.log('✅ Got audio from Google:', audioBuffer.byteLength, 'bytes');
        
        return new Response(audioBuffer, {
          headers: {
            'Content-Type': 'audio/mpeg',
            'Content-Length': audioBuffer.byteLength.toString(),
          },
        });
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
