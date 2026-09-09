import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { text, voice = 'en_US_1' } = await request.json();
    if (!text?.trim()) {
      return NextResponse.json({ error: 'Missing text' }, { status: 400 });
    }

    console.log(`📝 TTS Request: text=${text.slice(0, 50)}... voice=${voice}`);

    // Use Elevenlabs free tier (1000 chars/month free)
    try {
      console.log(`🎵 Using ElevenLabs Free Tier...`);
      
      // Map voice names to ElevenLabs voice IDs (free tier)
      const voiceMap: Record<string, string> = {
        'en_US_1': '21m00Tcm4TlvDq8ikWAM', // Rachel
        'en_US_2': 'jBpfuIE2acCO8z3wKNLl', // Clyde
        'en_US_3': 'EXAVITQu4vr4xnSDxMaL', // Sarah
        'en_US_4': 'MF3mGyEYCl7XYWbV9V6H', // Chester
        'en_US_5': 'N2lVS1Cmj1cSdlYyfsKh', // Eric
        'en_US_6': 'xl4z0cJrJ3yHfmT3VwOC', // Freya
        'en_US_7': 'lzHdN7Ug02WQzlZ40Pvo', // George
        'en_US_8': 'yoZ06aMxZJJ28mfd3foQ', // Gigi
        'en_US_9': 'TX3LPaxmHKQFdvZL82Vx', // Giovanni
        'en_US_10': 'V37jMyMsr5ZeQeFVRUI1', // Glinda
        'en_GB_1': 'piTKgcLEGmPLwcI5ILRM', // Grace
        'en_GB_2': 'n9By9xetLvim5HVlT9j7', // Harry
        'en_GB_3': 'SOZo9gQpa14KisCstlUc', // Jacklin
        'en_GB_4': '5Q0fKroPuJLjzgyeV3QN', // James
        'en_GB_5': 'K2ErucLdGMORAxZEJ9pL', // Jeremy
        'en_GB_6': 'oWAxZDx7w5VEj9dCyTzz', // Jessie
        'en_AU_1': 'JBFqnCBsd6RMkjVY5Yap', // Jimmy
        'en_AU_2': 'XB0fDUnXU5powFXDhCwa', // Joanne
        'en_AU_3': 'EYLvDqVQ5Z7aZ5uT4p9C', // Jony
        'en_IN_1': '1HZ4LksqWmKbNrj7MqDE', // Joseph
        'en_IN_2': 'bFZqVqBVFEsDeKqe5E5V', // Josh
        'en_IN_3': 'cgSugzbLFUc3D6z28Es5', // Jude
        'en_CA_1': 'iP95p4xoKVk53GoZ742B', // Juniper
        'en_CA_2': 'LcfcDJNUP1AQnzWaxZXw', // Kimberly
        'en_NZ_1': 'aZz5NHp61OY24e9M81Ww', // Knoll
        'en_NZ_2': 'EXAVITQu4vr4xnSDxMaL', // Laura
      };

      const voiceId = voiceMap[voice] || voiceMap['en_US_1'];
      
      const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + voiceId, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': process.env.ELEVENLABS_API_KEY || '',
        },
        body: JSON.stringify({
          text: text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      });

      if (response.ok) {
        const audioBuffer = await response.arrayBuffer();
        console.log('✅ Got audio from ElevenLabs:', audioBuffer.byteLength, 'bytes');
        
        return new Response(audioBuffer, {
          headers: {
            'Content-Type': 'audio/mpeg',
            'Content-Length': audioBuffer.byteLength.toString(),
          },
        });
      } else {
        console.warn('⚠️ ElevenLabs failed:', response.status);
      }
    } catch (elevenError) {
      console.warn('⚠️ ElevenLabs error:', elevenError instanceof Error ? elevenError.message : 'Unknown');
    }

    // Fallback: pyttsx3 simulation or Google Translate
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
      { error: 'TTS service unavailable. Please try again.' },
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
