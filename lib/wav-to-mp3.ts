/**
 * Converts a WAV Blob (produced by Kokoro's RawAudio.toBlob()) to an MP3 Blob
 * using lamejs — pure JS, runs entirely in the browser, no server round-trip.
 *
 * Quality: 128 kbps — transparent for speech.
 */
export async function wavToMp3(wavBlob: Blob): Promise<Blob> {
  const { Mp3Encoder, WavHeader } = await import('lamejs');

  const arrayBuffer = await wavBlob.arrayBuffer();
  const dataView    = new DataView(arrayBuffer);
  const header      = WavHeader.readHeader(dataView);

  if (!header) throw new Error('Could not parse WAV header');

  const { channels, sampleRate, dataOffset, dataLen } = header;

  // PCM samples from the WAV data chunk (16-bit signed, interleaved)
  const pcm = new Int16Array(arrayBuffer, dataOffset, dataLen / 2);

  const encoder = new Mp3Encoder(channels, sampleRate, 128);

  // Collect encoded bytes as plain ArrayBuffers to keep TypeScript happy
  const parts: ArrayBuffer[] = [];

  const push = (chunk: Int8Array) => {
    if (chunk.length > 0) {
      // Copy into a fresh ArrayBuffer so the type is unambiguous
      const buf = new ArrayBuffer(chunk.length);
      new Int8Array(buf).set(chunk);
      parts.push(buf);
    }
  };

  const chunkSize = 1152;

  if (channels === 1) {
    for (let i = 0; i < pcm.length; i += chunkSize) {
      const slice = new Int16Array(pcm.buffer, pcm.byteOffset + i * 2,
        Math.min(chunkSize, pcm.length - i));
      push(encoder.encodeBuffer(slice, slice));
    }
  } else {
    for (let i = 0; i < pcm.length; i += chunkSize * 2) {
      const frameCount = Math.min(chunkSize, (pcm.length - i) / 2);
      const left  = new Int16Array(frameCount);
      const right = new Int16Array(frameCount);
      for (let j = 0; j < frameCount; j++) {
        left[j]  = pcm[i + j * 2];
        right[j] = pcm[i + j * 2 + 1];
      }
      push(encoder.encodeBuffer(left, right));
    }
  }

  push(encoder.flush());

  return new Blob(parts, { type: 'audio/mpeg' });
}
