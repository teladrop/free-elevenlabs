import { NextRequest, NextResponse } from 'next/server';

function encodeWAV(samples: Float32Array, sampleRate: number): Buffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = samples.length * 2;
  const bufferSize = 44 + dataSize;
  const buffer = Buffer.alloc(bufferSize);
  let offset = 0;

  buffer.write('RIFF', offset); offset += 4;
  buffer.writeUInt32LE(36 + dataSize, offset); offset += 4;
  buffer.write('WAVE', offset); offset += 4;
  buffer.write('fmt ', offset); offset += 4;
  buffer.writeUInt32LE(16, offset); offset += 4;
  buffer.writeUInt16LE(1, offset); offset += 2;
  buffer.writeUInt16LE(numChannels, offset); offset += 2;
  buffer.writeUInt32LE(sampleRate, offset); offset += 4;
  buffer.writeUInt32LE(byteRate, offset); offset += 4;
  buffer.writeUInt16LE(blockAlign, offset); offset += 2;
  buffer.writeUInt16LE(bitsPerSample, offset); offset += 2;
  buffer.write('data', offset); offset += 4;
  buffer.writeUInt32LE(dataSize, offset); offset += 4;

  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(s < 0 ? s * 0x8000 : s * 0x7fff, offset);
    offset += 2;
  }
  return buffer;
}

function generateDemoAudio(text: string, sampleRate: number = 24000): Buffer {
  const durationMs = Math.max(500, text.length * 25);
  const samples = Math.floor((durationMs / 1000) * sampleRate);
  const audioData = new Float32Array(samples);
  
  const frequency = 440;
  for (let i = 0; i < samples; i++) {
    audioData[i] = Math.sin((2 * Math.PI * frequency * i) / sampleRate) * 0.3;
  }
  
  return encodeWAV(audioData, sampleRate);
}

export async function POST(request: NextRequest) {
  try {
    const { text, voice = 'en-US-AriaNeural', speed = 1.0 } = await request.json();
    if (!text?.trim()) {
      return NextResponse.json({ error: 'Missing text' }, { status: 400 });
    }

    console.log(`📝 TTS Request: text=${text.slice(0, 50)}... voice=${voice} speed=${speed}`);

    // Map Edge voice names to FreeTTS voice IDs
    const voiceMap: Record<string, string> = {
      'en-US-AriaNeural': 'en_us_male_1',
      'en-US-GuyNeural': 'en_us_male_2',
      'en-US-AmberNeural': 'en_us_female_1',
      'en-US-AshleyNeural': 'en_us_female_2',
      'en-US-CoraNeural': 'en_us_female_3',
      'en-US-ElizabethNeural': 'en_us_female_4',
      'en-US-MichelleNeural': 'en_us_female_5',
      'en-US-MonicaNeural': 'en_us_female_6',
      'en-US-SaraNeural': 'en_us_female_7',
      'en-US-AvaNeural': 'en_us_female_8',
      'en-US-BrianNeural': 'en_us_male_3',
      'en-US-ChristopherNeural': 'en_us_male_4',
      'en-US-EricNeural': 'en_us_male_5',
      'en-US-JacobNeural': 'en_us_male_6',
      'en-US-JasonNeural': 'en_us_male_7',
      'en-US-JerryNeural': 'en_us_male_8',
      'en-US-RyanNeural': 'en_us_male_9',
      'en-US-TonyNeural': 'en_us_male_10',
      'en-GB-SoniaNeural': 'en_gb_female_1',
      'en-GB-RyanNeural': 'en_gb_male_1',
      'en-GB-MaisieNeural': 'en_gb_female_2',
      'en-GB-LibbyNeural': 'en_gb_female_3',
      'en-GB-OliverNeural': 'en_gb_male_2',
      'en-GB-NoahNeural': 'en_gb_male_3',
      'en-IE-EmilyNeural': 'en_ie_female_1',
      'en-IE-ConnorNeural': 'en_ie_male_1',
    };

    const freettsVoice = voiceMap[voice] || 'en_us_female_1';

    // Try FreeTTS API (free, no API key)
    try {
      console.log(`🎵 Using FreeTTS API (voice: ${freettsVoice})...`);
      
      const response = await fetch('https://api.freetts.org/synthesize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          voice_id: freettsVoice,
          speed: speed,
        }),
      });

      console.log('📡 FreeTTS response status:', response.status);

      if (response.ok) {
        const audioBuffer = await response.arrayBuffer();
        console.log('✅ Got audio:', audioBuffer.byteLength, 'bytes');
        return new Response(audioBuffer, {
          headers: {
            'Content-Type': 'audio/mpeg',
            'Content-Length': audioBuffer.byteLength.toString(),
          },
        });
      } else {
        console.warn('⚠️ FreeTTS failed:', response.status);
      }
    } catch (freettsError) {
      console.warn('⚠️ FreeTTS error:', freettsError instanceof Error ? freettsError.message : 'Unknown');
    }

    // Fallback: Try Google TTS
    try {
      console.log('🎵 Fallback: Using Google TTS...');
      
      const encodedText = encodeURIComponent(text);
      const response = await fetch(`https://translate.google.com/translate_tts?ie=UTF-8&q=${encodedText}&tl=en&client=tw-ob`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

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

    // Final fallback: demo audio
    console.log('🎵 Generating demo audio (all APIs failed)...');
    const demoWav = generateDemoAudio(text);
    
    return new Response(demoWav, {
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': demoWav.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error('❌ API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
