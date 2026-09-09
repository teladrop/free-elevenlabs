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

    // Try to load and use Kokoro model
    try {
      const { KokoroTTS } = await import('kokoro-js');
      console.log('🎵 Loading Kokoro model...');
      
      const model = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
        dtype: 'q8',
        device: 'cpu',
      });
      
      console.log('✅ Model loaded, generating audio...');
      const audio = await model.generate(text, { voice, speed });
      const wavBuffer = encodeWAV(audio.audio, audio.sampling_rate);
      
      return new Response(wavBuffer, {
        headers: {
          'Content-Type': 'audio/wav',
          'Content-Length': wavBuffer.byteLength.toString(),
        },
      });
    } catch (kokoroError) {
      // Return error instead of fallback
      console.error(`❌ Kokoro error:`, kokoroError);
      return new Response(
        JSON.stringify({ 
          error: kokoroError instanceof Error ? kokoroError.message : 'Unknown error',
          stack: kokoroError instanceof Error ? kokoroError.stack : ''
        }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  } catch (error) {
    console.error('❌ API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
