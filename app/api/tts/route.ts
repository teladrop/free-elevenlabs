import { Communicate } from "edge-tts-universal";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const DEFAULT_VOICE = "en-US-EmmaMultilingualNeural";

export async function POST(request: NextRequest) {
  let body: {
    text?: string;
    voice?: string;
    rate?: string;
    volume?: string;
    pitch?: string;
  };

  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { text, voice, rate, volume, pitch } = body;

  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return new Response(JSON.stringify({ error: "text is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const communicate = new Communicate(text.trim(), {
      voice: voice || DEFAULT_VOICE,
      ...(rate   && { rate }),
      ...(volume && { volume }),
      ...(pitch  && { pitch }),
    });

    const chunks: Buffer[] = [];
    for await (const chunk of communicate.stream()) {
      if (chunk.type === "audio" && chunk.data) {
        chunks.push(chunk.data);
      }
    }

    if (chunks.length === 0) {
      return new Response(JSON.stringify({ error: "No audio received from TTS service" }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    const audioBuffer = Buffer.concat(chunks);

    return new Response(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": audioBuffer.byteLength.toString(),
        "Cross-Origin-Resource-Policy": "same-origin",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "TTS synthesis failed";
    console.error("[/api/tts]", err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
