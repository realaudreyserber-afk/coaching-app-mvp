/**
 * POST /api/ai/coach-audio
 *
 * Body: { text: string, voice?: string }
 *
 * Returns an audio/ogg streaming response synthesized by Google Cloud
 * Text-to-Speech (WaveNet voices — 4M chars/mois gratuit à vie).
 *
 * Default voice: fr-FR-Wavenet-D (masculine, grave, neutre — fit pour
 * le ton "coach sec, tactical" NoDream).
 *
 * Auth: standard Bearer token. Rate-limit: 60 phrases/min/user.
 *
 * The route falls back to a 503 if GOOGLE_CREDENTIALS_BASE64 is not set,
 * so the app keeps working without the TTS feature (Wave 3E rolled out
 * behind the flags.coachAudio() flag).
 */
import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/features/sessions/auth";
import { checkRateLimit } from "@/lib/firebase/rate-limit";

export const runtime = "nodejs";

interface CoachAudioBody {
  text: string;
  voice?: string;
}

const ALLOWED_VOICES = new Set([
  "fr-FR-Wavenet-A", // female, neutral
  "fr-FR-Wavenet-B", // male, brighter
  "fr-FR-Wavenet-C", // female, warmer
  "fr-FR-Wavenet-D", // male, grave (default — coach NoDream)
  "fr-FR-Wavenet-E", // female, more articulate
  "fr-FR-Standard-D", // standard fallback if WaveNet quota hit
]);

const DEFAULT_VOICE = "fr-FR-Wavenet-D";
const MAX_TEXT_LEN = 500;

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { uid } = auth;

  const rl = await checkRateLimit(uid, {
    scope: "coach_audio",
    perMinute: 60,
    perHour: 600,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "rate_limited", retry_after_sec: rl.retryAfterSec },
      { status: 429 },
    );
  }

  let body: CoachAudioBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const text = (body?.text ?? "").trim();
  if (!text || typeof text !== "string") {
    return NextResponse.json({ error: "text required" }, { status: 400 });
  }
  if (text.length > MAX_TEXT_LEN) {
    return NextResponse.json(
      { error: "text_too_long", max: MAX_TEXT_LEN },
      { status: 400 },
    );
  }

  const voice =
    body.voice && ALLOWED_VOICES.has(body.voice) ? body.voice : DEFAULT_VOICE;

  // Check credentials presence — degrade gracefully if TTS not configured
  const credsB64 = process.env.GOOGLE_CREDENTIALS_BASE64;
  if (!credsB64) {
    return NextResponse.json(
      {
        error: "tts_not_configured",
        hint: "Set GOOGLE_CREDENTIALS_BASE64 env to enable coach audio",
      },
      { status: 503 },
    );
  }

  try {
    // Lazy-import to avoid loading the gRPC SDK when the route is cold and
    // the credentials are missing.
    const { TextToSpeechClient } = await import("@google-cloud/text-to-speech");
    const credentials = JSON.parse(
      Buffer.from(credsB64, "base64").toString("utf-8"),
    );
    const client = new TextToSpeechClient({ credentials });

    const [response] = await client.synthesizeSpeech({
      input: { text },
      voice: { languageCode: "fr-FR", name: voice },
      audioConfig: {
        // OGG_OPUS = best compromise for browser playback + low bandwidth.
        audioEncoding: "OGG_OPUS",
        speakingRate: 1.05, // slight uptick for energetic coaching delivery
        pitch: -2.0, // lower pitch for tactical/grave feel
      },
    });

    if (!response.audioContent) {
      return NextResponse.json(
        { error: "tts_empty_response" },
        { status: 502 },
      );
    }

    const audioBuffer =
      typeof response.audioContent === "string"
        ? Buffer.from(response.audioContent, "base64")
        : Buffer.from(response.audioContent as Uint8Array);

    return new Response(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/ogg",
        "Cache-Control": "no-store",
        "Content-Length": String(audioBuffer.length),
      },
    });
  } catch (err) {
    console.error("[coach-audio] TTS failed:", err);
    return NextResponse.json(
      { error: "tts_failed", detail: String(err) },
      { status: 502 },
    );
  }
}
