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
  return generateVoiceAudio(text, 440, 1.0, sampleRate);
}

export async function POST(request: NextRequest) {
  try {
    const { text, voice = 'en-US-AriaNeural', speed = 1.0 } = await request.json();
    if (!text?.trim()) {
      return NextResponse.json({ error: 'Missing text' }, { status: 400 });
    }

    console.log(`📝 TTS Request: text=${text.slice(0, 50)}... voice=${voice} speed=${speed}`);

    // Generate unique audio based on voice name for demo
    // Each voice gets different pitch/frequency characteristics
    const voicePitches: Record<string, number> = {
      'en-US-AriaNeural': 440,      // Standard female
      'en-US-AmberNeural': 480,     // Higher female
      'en-US-AshleyNeural': 520,    // High female
      'en-US-CoraNeural': 460,      // Medium female
      'en-US-ElizabethNeural': 500, // Bright female
      'en-US-MichelleNeural': 470,  // Lower female
      'en-US-MonicaNeural': 510,    // Warm female
      'en-US-SaraNeural': 450,      // Soft female
      'en-US-AvaNeural': 465,       // Sweet female
      'en-US-GuyNeural': 220,       // Deep male
      'en-US-BrianNeural': 240,     // Warm male
      'en-US-ChristopherNeural': 260,
      'en-US-EricNeural': 250,
      'en-US-JacobNeural': 230,
      'en-US-JasonNeural': 245,
      'en-US-JerryNeural': 255,
      'en-US-RyanNeural': 235,
      'en-US-TonyNeural': 265,
      'en-GB-SoniaNeural': 475,     // British female
      'en-GB-MaisieNeural': 495,
      'en-GB-LibbyNeural': 485,
      'en-GB-RyanNeural': 245,      // British male
      'en-GB-OliverNeural': 255,
      'en-GB-NoahNeural': 235,
      'en-IE-EmilyNeural': 490,     // Irish female
      'en-IE-ConnorNeural': 250,    // Irish male
    };

    const frequency = voicePitches[voice] || 440;
    
    // Generate unique audio with voice-specific frequency
    const audioWav = generateVoiceAudio(text, frequency, speed);
    
    console.log('✅ Generated demo audio with frequency:', frequency);
    return new Response(audioWav, {
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': audioWav.byteLength.toString(),
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

function generateVoiceAudio(text: string, frequency: number, speed: number, sampleRate: number = 24000): Buffer {
  // Generate audio with voice-specific frequency and amplitude variations
  const baseDuration = text.length * 40; // milliseconds
  const duration = Math.floor(baseDuration / speed); // Adjust for speed
  const samples = Math.floor((duration / 1000) * sampleRate);
  const audioData = new Float32Array(samples);
  
  // Create variation in the waveform based on text characteristics
  let hasQuestion = text.includes('?');
  let hasExclamation = text.includes('!');
  let hasComma = text.includes(',');
  
  let pitchVariation = 1.0;
  if (hasQuestion) pitchVariation = 1.1; // Raise pitch for questions
  if (hasExclamation) pitchVariation = 0.95; // Lower for excitement
  
  // Generate complex waveform (sine + harmonic) for more natural sound
  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate;
    const baseWave = Math.sin(2 * Math.PI * frequency * pitchVariation * t);
    const harmonic2 = Math.sin(2 * Math.PI * frequency * 2 * t) * 0.3;
    const harmonic3 = Math.sin(2 * Math.PI * frequency * 3 * t) * 0.1;
    
    // Add amplitude envelope to simulate speech patterns
    let envelope = 1.0;
    if (hasComma && i > samples * 0.4 && i < samples * 0.5) {
      envelope = 0.5; // Dip at comma pause
    }
    
    audioData[i] = (baseWave + harmonic2 + harmonic3) * 0.2 * envelope;
  }
  
  return encodeWAV(audioData, sampleRate);
}
