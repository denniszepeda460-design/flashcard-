import { get, post, getBaseUrl, getApiKey } from './client';

export interface TTSVoice {
  id: string;
  name: string;
  locale?: string;
  lang?: string;
  lang_code: string;
  gender?: string;
  quality?: string;
  size_mb?: number;
  installed?: boolean;
  recommended?: boolean;
}

export interface PiperVoiceInfo extends TTSVoice {
  quality: string;
  size_mb: number;
  installed: boolean;
  piper_available: boolean;
}

export interface VoicesResponse {
  engine?: string;
  piper_available: boolean;
  voices: TTSVoice[];
}

export interface DetectLanguageResponse {
  text: string;
  detected_lang: string;
  recommended_voice: string;
}

export async function fetchTTSVoices(engine: string = 'edge'): Promise<VoicesResponse> {
  return get<VoicesResponse>(`/api/tts/voices?engine=${encodeURIComponent(engine)}`);
}

export async function fetchPiperVoices(): Promise<VoicesResponse> {
  return fetchTTSVoices('piper');
}

export async function downloadPiperVoice(voiceId: string): Promise<{ success: boolean; message: string }> {
  return post<{ success: boolean; message: string }>('/api/tts/download', { voice_id: voiceId });
}

export async function detectLanguage(text: string): Promise<DetectLanguageResponse> {
  return post<DetectLanguageResponse>('/api/tts/detect-language', { text });
}

export async function synthesizeAudio(
  text: string,
  voiceId?: string,
  speed: number = 1.0,
  engine: string = 'edge',
  lang?: string
): Promise<Blob> {
  const baseUrl = getBaseUrl();
  const apiKey = getApiKey();

  const res = await fetch(`${baseUrl}/api/tts/synthesize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    body: JSON.stringify({
      text,
      voice_id: voiceId || 'auto',
      engine: engine || 'edge',
      speed,
      lang,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Error en síntesis TTS (${res.status}): ${errText}`);
  }

  return res.blob();
}

// Retro-compatible alias for existing code
export async function synthesizePiperAudio(text: string, voiceId?: string, speed: number = 1.0): Promise<Blob> {
  const engine = localStorage.getItem('tts_engine') || 'edge';
  return synthesizeAudio(text, voiceId, speed, engine);
}
