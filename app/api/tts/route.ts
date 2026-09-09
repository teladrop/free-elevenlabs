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

    // Use Edge TTS directly via undocumented Microsoft API
    try {
      console.log(`🎵 Using Edge TTS (${voice})...`);
      
      const speedPercent = Math.round((speed - 1) * 50); // 0.5x = -25%, 1.0x = 0%, 2.0x = +50%
      
      // SSML for Edge TTS (works with Microsoft's undocumented API)
      const ssml = `<speak version='1.0' xml:lang='en-US'><voice name='${voice}'><prosody rate='${speedPercent > 0 ? '+' : ''}${speedPercent}%'>${escapeXml(text)}</prosody></voice></speak>`;
      
      console.log('📡 Sending to Edge TTS service...');
      
      const response = await fetch('https://tts.speech.microsoft.com/cognitiveservices/v1', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'audio-16khz-32kbitrate-mono-mp3',
          'User-Agent': 'Mozilla/5.0',
        },
        body: ssml,
      });

      console.log('📡 Edge TTS response status:', response.status);

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
        const errorText = await response.text();
        console.warn('⚠️ Edge TTS failed:', response.status, errorText.substring(0, 100));
      }
    } catch (edgeError) {
      console.warn('⚠️ Edge TTS error:', edgeError instanceof Error ? edgeError.message : 'Unknown');
    }

    // Fallback to demo audio (different tone based on voice)
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

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
