import { useState, useCallback, useEffect, useRef } from 'react';
import { synthesizeAudio } from '../api/tts';

export function useTTS(defaultLang: string = 'auto', onShortcut?: () => void) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  const stop = useCallback(() => {
    // Stop Web Speech
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    // Stop HTMLAudio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  const fallbackBrowserSpeak = useCallback((text: string, targetLang: string, speed: number = 1.0) => {
    if (!('speechSynthesis' in window)) {
      setIsSpeaking(false);
      return;
    }

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const effectiveLang = (!targetLang || targetLang === 'auto') ? 'es-ES' : targetLang;
      utterance.lang = effectiveLang;
      utterance.rate = Math.min(Math.max(speed, 0.5), 2.0);

      const voices = window.speechSynthesis.getVoices();
      const langPrefix = effectiveLang.split('-')[0].toLowerCase();
      const voice = voices.find((v) => v.lang.toLowerCase().startsWith(langPrefix));
      if (voice) {
        utterance.voice = voice;
      }

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      window.speechSynthesis.speak(utterance);
    } catch {
      setIsSpeaking(false);
    }
  }, []);

  const speak = useCallback(
    async (text: string, lang?: string, preferredVoiceId?: string) => {
      if (!text || !text.trim()) return;

      stop(); // Stop any active audio before starting

      const cleanText = text.replace(/<[^>]*>/g, '').trim();
      if (!cleanText) return;

      const targetLang = lang || defaultLang || 'auto';

      // Read user preferences
      // Default engine is 'edge' for ultra-clear natural neural voices
      const ttsEngine = localStorage.getItem('tts_engine') || 'edge';
      const savedVoice =
        preferredVoiceId ||
        localStorage.getItem('tts_voice') ||
        localStorage.getItem('tts_piper_voice') ||
        'auto';
      const ttsSpeed = parseFloat(localStorage.getItem('tts_speed') || '1.0');

      // Attempt Edge-TTS or Piper TTS through API
      if (ttsEngine === 'edge' || ttsEngine === 'piper') {
        try {
          setIsSpeaking(true);
          const blob = await synthesizeAudio(
            cleanText,
            savedVoice,
            ttsSpeed,
            ttsEngine,
            targetLang !== 'auto' ? targetLang : undefined
          );
          const url = URL.createObjectURL(blob);
          audioUrlRef.current = url;
          const audio = new Audio(url);
          audioRef.current = audio;

          audio.onended = () => {
            setIsSpeaking(false);
            if (audioUrlRef.current) {
              URL.revokeObjectURL(audioUrlRef.current);
              audioUrlRef.current = null;
            }
          };

          audio.onerror = () => {
            setIsSpeaking(false);
            // Fallback to browser TTS if audio playback fails
            fallbackBrowserSpeak(cleanText, targetLang, ttsSpeed);
          };

          await audio.play();
          return;
        } catch (ttsErr) {
          console.warn(`Síntesis con motor '${ttsEngine}' no disponible, usando fallback del navegador:`, ttsErr);
        }
      }

      // Fallback to Web Speech API
      fallbackBrowserSpeak(cleanText, targetLang, ttsSpeed);
    },
    [defaultLang, stop, fallbackBrowserSpeak]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInputFocused =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        (activeEl as HTMLElement)?.isContentEditable;

      // 1. Shortcut: Alt + T or Alt + A
      const isAltT = e.altKey && (e.key.toLowerCase() === 't' || e.code === 'KeyT');
      const isAltA = e.altKey && (e.key.toLowerCase() === 'a' || e.code === 'KeyA');

      // 2. Shortcut: 'r' or 'R' (standard replay audio shortcut, only when NOT typing in an input)
      const isReplayKey =
        !isInputFocused &&
        !e.ctrlKey &&
        !e.altKey &&
        !e.metaKey &&
        (e.key.toLowerCase() === 'r' || e.code === 'KeyR');

      if (isAltT || isAltA || isReplayKey) {
        e.preventDefault();
        e.stopPropagation();
        if (onShortcut) {
          onShortcut();
        } else {
          const selection = window.getSelection()?.toString().trim();
          if (selection) {
            speak(selection);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      stop();
    };
  }, [onShortcut, speak, stop]);

  return { speak, stop, isSpeaking };
}
