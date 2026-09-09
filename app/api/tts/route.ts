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
  // Generate demo sine wave audio (not silent - actually plays a tone)
  const durationMs = Math.max(500, text.length * 25); // ~25ms per character
  const samples = Math.floor((durationMs / 1000) * sampleRate);
  const audioData = new Float32Array(samples);
  
  // Generate simple sine wave at 440Hz (A note)
  const frequency = 440;
  for (let i = 0; i < samples; i++) {
    audioData[i] = Math.sin((2 * Math.PI * frequency * i) / sampleRate) * 0.3; // 0.3 = volume
  }
  
  return encodeWAV(audioData, sampleRate);
}

export async function POST(request: NextRequest) {
  try {
    const { text, voice = 'af_heart', speed = 1.0 } = await request.json();
    if (!text?.trim()) {
      return NextResponse.json({ error: 'Missing text' }, { status: 400 });
    }

    console.log(`📝 TTS Request: text=${text.slice(0, 50)}... voice=${voice}`);

    // Try Google Text-to-Speech API (free, no auth required)
    try {
      console.log('🎵 Using Google TTS API...');
      
      // URL encode the text
      const encodedText = encodeURIComponent(text);
      
      // Google's free TTS endpoint (no API key needed for basic usage)
      const googleTtsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodedText}&tl=en&client=tw-ob`;
      
      console.log('📡 Fetching from:', googleTtsUrl);
      
      const response = await fetch(googleTtsUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      console.log('📡 Google TTS response status:', response.status);
      
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
        console.warn('❌ Google TTS returned status:', response.status);
      }
    } catch (googleError) {
      console.error('❌ Google TTS error:', googleError);
    }

    // Fallback to demo audio
    console.log('🎵 Generating demo audio...');
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
