import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { useSettingsStore } from '../stores/settingsStore';
import { fetchTTSVoices, downloadPiperVoice, TTSVoice } from '../api/tts';
import { useTTS } from '../hooks/useTTS';
import { Volume2, Download, Check, Loader2, Sparkles, Radio, Globe } from 'lucide-react';

export default function SettingsPage() {
  const { backendUrl, setBackendUrl, apiKey, setApiKey, theme, setTheme } = useSettingsStore();

  // TTS Settings State
  const [engine, setEngine] = useState<string>(() => localStorage.getItem('tts_engine') || 'edge');
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>(
    () => localStorage.getItem('tts_voice') || 'auto'
  );
  const [speed, setSpeed] = useState<number>(() => parseFloat(localStorage.getItem('tts_speed') || '1.0'));

  const [piperAvailable, setPiperAvailable] = useState<boolean>(true);
  const [voices, setVoices] = useState<TTSVoice[]>([]);
  const [loadingVoices, setLoadingVoices] = useState<boolean>(false);
  const [downloadingVoiceId, setDownloadingVoiceId] = useState<string | null>(null);
  const [ttsFeedback, setTtsFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { speak, isSpeaking } = useTTS();

  const loadVoices = async (currentEngine: string) => {
    setLoadingVoices(true);
    try {
      const data = await fetchTTSVoices(currentEngine);
      setPiperAvailable(data.piper_available);
      setVoices(data.voices || []);
    } catch (err: any) {
      console.warn(`No se pudieron cargar las voces para ${currentEngine}:`, err);
      if (currentEngine === 'piper') setPiperAvailable(false);
    } finally {
      setLoadingVoices(false);
    }
  };

  useEffect(() => {
    loadVoices(engine);
  }, [engine]);

  const handleEngineChange = (newEngine: string) => {
    setEngine(newEngine);
    localStorage.setItem('tts_engine', newEngine);
    if (newEngine === 'edge') {
      const savedEdgeVoice = localStorage.getItem('tts_voice') || 'auto';
      setSelectedVoiceId(savedEdgeVoice);
    } else if (newEngine === 'piper') {
      const savedPiperVoice = localStorage.getItem('tts_piper_voice') || 'es_ES-davefx-medium';
      setSelectedVoiceId(savedPiperVoice);
    }
  };

  const handleVoiceChange = (newVoiceId: string) => {
    setSelectedVoiceId(newVoiceId);
    if (engine === 'edge') {
      localStorage.setItem('tts_voice', newVoiceId);
    } else if (engine === 'piper') {
      localStorage.setItem('tts_piper_voice', newVoiceId);
    }
  };

  const handleSpeedChange = (newSpeed: number) => {
    setSpeed(newSpeed);
    localStorage.setItem('tts_speed', newSpeed.toString());
  };

  const handleDownloadVoice = async (voiceId: string) => {
    setDownloadingVoiceId(voiceId);
    setTtsFeedback(null);
    try {
      await downloadPiperVoice(voiceId);
      setTtsFeedback({ type: 'success', text: `¡Modelo de voz descargado correctamente!` });
      await loadVoices('piper');
    } catch (err: any) {
      setTtsFeedback({ type: 'error', text: `Error descargando voz: ${err.message || String(err)}` });
    } finally {
      setDownloadingVoiceId(null);
    }
  };

  const currentVoiceObj = voices.find((v) => v.id === selectedVoiceId);

  const handleTestAudio = () => {
    if (selectedVoiceId === 'auto') {
      speak('Hola, this is an automatic test, Guten Tag und viel Erfolg!');
      return;
    }

    const langCode = currentVoiceObj?.lang_code || '';
    let testSample = 'Hola, esta es una prueba de voz ultraclara con Edge TTS.';

    if (langCode === 'en') {
      testSample = 'Hello! This is a crystal clear neural text to speech test.';
    } else if (langCode === 'de') {
      testSample = 'Hallo! Dies ist ein sehr klarer deutscher Sprachsynthese-Test.';
    } else if (langCode === 'fr') {
      testSample = 'Bonjour! Ceci est un test de synthèse vocale claire.';
    } else if (langCode === 'it') {
      testSample = 'Ciao! Questa è una prova di sintesi vocale molto chiara.';
    } else if (langCode === 'pt') {
      testSample = 'Olá! Este é um teste de síntese de voz neural muito claro.';
    } else if (langCode === 'ja') {
      testSample = 'こんにちは、これは音声合成のテストです。';
    }

    speak(testSample, currentVoiceObj?.lang || 'es-ES', selectedVoiceId);
  };

  return (
    <div className="max-w-xl mx-auto space-y-6 pb-12">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-stone-900 dark:text-zinc-100">
          Ajustes
        </h1>
        <p className="text-xs text-stone-500 dark:text-zinc-400 mt-0.5">
          Configuración del servidor local, voces neuronales y preferencias
        </p>
      </div>

      {/* SECTION: Servidor */}
      <Card className="border border-stone-200 dark:border-zinc-800 rounded-2xl shadow-xs overflow-hidden bg-white dark:bg-zinc-900">
        <CardHeader className="bg-stone-50/60 dark:bg-zinc-950/40 border-b border-stone-200/80 dark:border-zinc-800 pb-3">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-zinc-400">
            Conexión Local
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-5 space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-stone-600 dark:text-zinc-400 mb-1">
              URL del Servidor (opcional)
            </label>
            <Input
              value={backendUrl}
              onChange={(e) => setBackendUrl(e.target.value)}
              placeholder="Dejar vacío para conexión automática (o http://localhost:8001)"
              className="text-xs font-mono"
            />
            <p className="text-[10px] text-stone-400 dark:text-zinc-500 mt-1">
              {backendUrl.includes(':5173') ? (
                <span className="text-amber-500 font-medium">
                  El puerto 5173 es el frontend, no el backend. Deja este campo vacío o usa el puerto 8001.
                </span>
              ) : (
                'Si dejas este campo vacío, la aplicación se conecta automáticamente al backend local.'
              )}
            </p>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-stone-600 dark:text-zinc-400 mb-1">
              Clave API
            </label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Tu clave API secreta"
              className="text-xs font-mono"
            />
          </div>
        </CardContent>
      </Card>

      {/* SECTION: Audio y Texto a Voz (TTS) */}
      <Card className="border border-stone-200 dark:border-zinc-800 rounded-2xl shadow-xs overflow-hidden bg-white dark:bg-zinc-900">
        <CardHeader className="bg-stone-50/60 dark:bg-zinc-950/40 border-b border-stone-200/80 dark:border-zinc-800 pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-zinc-400 flex items-center gap-1.5">
              <Volume2 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              <span>Texto a Voz (TTS) y Pronunciación</span>
            </CardTitle>
            <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800/40 flex items-center gap-1">
              <Sparkles className="h-2.5 w-2.5" />
              {engine === 'edge' ? 'Edge Neural Activo' : engine === 'piper' ? 'Piper Activo' : 'Navegador'}
            </span>
          </div>
        </CardHeader>
        <CardContent className="pt-5 space-y-4">
          {ttsFeedback && (
            <div
              className={`p-2.5 rounded-xl text-xs font-medium flex items-center gap-2 ${
                ttsFeedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40'
                  : 'bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40'
              }`}
            >
              {ttsFeedback.type === 'success' ? (
                <Check className="h-3.5 w-3.5 shrink-0" />
              ) : null}
              <span>{ttsFeedback.text}</span>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-semibold text-stone-600 dark:text-zinc-400 mb-1.5">
              Motor de Síntesis Vocal
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {/* Opción 1: Edge-TTS */}
              <button
                type="button"
                onClick={() => handleEngineChange('edge')}
                className={`py-2 px-3 rounded-xl border text-xs font-medium text-left transition-all pressable ${
                  engine === 'edge'
                    ? 'border-blue-600 bg-blue-50/50 text-blue-900 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-500'
                    : 'border-stone-200 dark:border-zinc-800 text-stone-600 dark:text-zinc-400 hover:bg-stone-50 dark:hover:bg-zinc-800'
                }`}
              >
                <div className="font-semibold flex items-center gap-1">
                  <span>Edge-TTS</span>
                  <span className="text-[9px] bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200 px-1 rounded font-normal">
                    Recomendado
                  </span>
                </div>
                <div className="text-[10px] text-stone-400 dark:text-zinc-500 mt-0.5">
                  Voz ultraclara y natural
                </div>
              </button>

              {/* Opción 2: Piper TTS */}
              <button
                type="button"
                onClick={() => handleEngineChange('piper')}
                className={`py-2 px-3 rounded-xl border text-xs font-medium text-left transition-all pressable ${
                  engine === 'piper'
                    ? 'border-blue-600 bg-blue-50/50 text-blue-900 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-500'
                    : 'border-stone-200 dark:border-zinc-800 text-stone-600 dark:text-zinc-400 hover:bg-stone-50 dark:hover:bg-zinc-800'
                }`}
              >
                <div className="font-semibold flex items-center gap-1.5">
                  <span>Piper TTS</span>
                </div>
                <div className="text-[10px] text-stone-400 dark:text-zinc-500 mt-0.5">
                  Local offline (ONNX)
                </div>
              </button>

              {/* Opción 3: Navegador */}
              <button
                type="button"
                onClick={() => handleEngineChange('browser')}
                className={`py-2 px-3 rounded-xl border text-xs font-medium text-left transition-all pressable ${
                  engine === 'browser'
                    ? 'border-blue-600 bg-blue-50/50 text-blue-900 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-500'
                    : 'border-stone-200 dark:border-zinc-800 text-stone-600 dark:text-zinc-400 hover:bg-stone-50 dark:hover:bg-zinc-800'
                }`}
              >
                <div className="font-semibold">Navegador</div>
                <div className="text-[10px] text-stone-400 dark:text-zinc-500 mt-0.5">
                  Web Speech integrada
                </div>
              </button>
            </div>
          </div>

          {/* Menú Desplegable y Configuración de Edge-TTS */}
          {engine === 'edge' && (
            <div className="p-3.5 rounded-xl bg-stone-50/70 dark:bg-zinc-950/40 border border-stone-200/80 dark:border-zinc-800 space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-semibold text-stone-600 dark:text-zinc-400 flex items-center gap-1">
                    <Globe className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                    <span>Idioma / Voz Neuronal (Menú desplegable)</span>
                  </label>
                  {loadingVoices && (
                    <span className="text-[10px] text-stone-400 flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Cargando voces...
                    </span>
                  )}
                </div>

                <select
                  value={selectedVoiceId}
                  onChange={(e) => handleVoiceChange(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs font-medium text-stone-800 dark:text-zinc-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="auto">
                    🌐 Detección Automática (Español, Inglés, Alemán...) [Por defecto]
                  </option>
                  <optgroup label="Español (Recomendado)">
                    <option value="es-ES-AlvaroNeural">🇪🇸 Español (España) - Álvaro (Muy Claro, Recomendado)</option>
                    <option value="es-ES-ElviraNeural">🇪🇸 Español (España) - Elvira (Femenino, Natural)</option>
                    <option value="es-MX-DaliaNeural">🇲🇽 Español (México) - Dalia (Neutro)</option>
                    <option value="es-MX-JorgeNeural">🇲🇽 Español (México) - Jorge (Masculino)</option>
                  </optgroup>
                  <optgroup label="Inglés (Recomendado)">
                    <option value="en-US-JennyNeural">🇺🇸 English (US) - Jenny (Crystal Clear, Recommended)</option>
                    <option value="en-US-GuyNeural">🇺🇸 English (US) - Guy (Male, Natural)</option>
                    <option value="en-GB-SoniaNeural">🇬🇧 English (UK) - Sonia (British Clear)</option>
                    <option value="en-GB-RyanNeural">🇬🇧 English (UK) - Ryan (Male, British)</option>
                  </optgroup>
                  <optgroup label="Alemán (Recomendado)">
                    <option value="de-DE-KatjaNeural">🇩🇪 Deutsch (Deutschland) - Katja (Sehr Klar, Empfohlen)</option>
                    <option value="de-DE-ConradNeural">🇩🇪 Deutsch (Deutschland) - Conrad (Männlich, Natürlich)</option>
                    <option value="de-DE-KillianNeural">🇩🇪 Deutsch (Deutschland) - Killian (Männlich)</option>
                  </optgroup>
                  <optgroup label="Otros Idiomas">
                    <option value="fr-FR-DeniseNeural">🇫🇷 Français (France) - Denise</option>
                    <option value="fr-FR-HenriNeural">🇫🇷 Français (France) - Henri</option>
                    <option value="it-IT-ElsaNeural">🇮🇹 Italiano (Italia) - Elsa</option>
                    <option value="pt-BR-FranciscaNeural">🇧🇷 Português (Brasil) - Francisca</option>
                    <option value="ja-JP-NanamiNeural">🇯🇵 日本語 (日本) - Nanami</option>
                  </optgroup>
                </select>

                <p className="text-[10px] text-stone-500 dark:text-zinc-400 mt-1.5 leading-relaxed">
                  {selectedVoiceId === 'auto'
                    ? '✨ Modo automático activo: Detecta si la tarjeta está en español, inglés, alemán u otro idioma y pronuncia con la voz nativa de mayor claridad.'
                    : 'Fijado manualmente: Todas las tarjetas se reproducirán con esta voz seleccionada.'}
                </p>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1 text-xs">
                <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                  ✓ Voz lista para usar (Calidad HD 24-48kHz)
                </span>

                <button
                  type="button"
                  onClick={handleTestAudio}
                  className={`py-1.5 px-3 rounded-lg text-xs font-medium border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/80 flex items-center gap-1.5 transition-colors pressable ${
                    isSpeaking ? 'animate-pulse' : ''
                  }`}
                >
                  <Volume2 className="h-3.5 w-3.5" />
                  <span>{isSpeaking ? 'Reproduciendo...' : 'Probar voz'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Menú y Configuración de Piper TTS */}
          {engine === 'piper' && (
            <div className="p-3.5 rounded-xl bg-stone-50/70 dark:bg-zinc-950/40 border border-stone-200/80 dark:border-zinc-800 space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-semibold text-stone-600 dark:text-zinc-400">
                    Modelo de Voz Piper (Local)
                  </label>
                  {loadingVoices && (
                    <span className="text-[10px] text-stone-400 flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Cargando catálogo...
                    </span>
                  )}
                </div>

                <select
                  value={selectedVoiceId}
                  onChange={(e) => handleVoiceChange(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs font-medium text-stone-800 dark:text-zinc-200 focus:outline-none focus:border-blue-500"
                >
                  {voices.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.installed ? '✓ [Instalada]' : '⬇ [Descargable]'} {v.name} ({v.quality})
                    </option>
                  ))}
                </select>
              </div>

              {currentVoiceObj && (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                  <div className="text-[11px] text-stone-500 dark:text-zinc-400">
                    Estado:{' '}
                    {currentVoiceObj.installed ? (
                      <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                        Instalada localmente
                      </span>
                    ) : (
                      <span className="font-medium text-amber-700 dark:text-amber-400">
                        No descargada ({currentVoiceObj.size_mb} MB aprox.)
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {!currentVoiceObj.installed && (
                      <button
                        type="button"
                        onClick={() => handleDownloadVoice(currentVoiceObj.id)}
                        disabled={downloadingVoiceId === currentVoiceObj.id}
                        className="py-1 px-2.5 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1.5 transition-colors pressable disabled:opacity-50"
                      >
                        {downloadingVoiceId === currentVoiceObj.id ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span>Descargando...</span>
                          </>
                        ) : (
                          <>
                            <Download className="h-3 w-3" />
                            <span>Descargar ({currentVoiceObj.size_mb} MB)</span>
                          </>
                        )}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleTestAudio}
                      className={`py-1 px-2.5 rounded-lg text-xs font-medium border border-stone-300 dark:border-zinc-700 text-stone-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-800 flex items-center gap-1.5 transition-colors pressable ${
                        isSpeaking ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 animate-pulse' : ''
                      }`}
                    >
                      <Volume2 className="h-3 w-3" />
                      <span>{isSpeaking ? 'Reproduciendo...' : 'Probar voz'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Velocidad de Pronunciación */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-semibold text-stone-600 dark:text-zinc-400">
                Velocidad de pronunciación: {speed.toFixed(2)}x
              </label>
              <button
                type="button"
                onClick={() => handleSpeedChange(1.0)}
                className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline"
              >
                Restablecer (1.0x)
              </button>
            </div>
            <input
              type="range"
              min="0.7"
              max="1.4"
              step="0.05"
              value={speed}
              onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
              className="w-full accent-blue-600 cursor-pointer"
            />
          </div>

          <div className="pt-2 border-t border-stone-200/80 dark:border-zinc-800">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-stone-500 dark:text-zinc-400 mb-1.5">
              Atajos de teclado de Audio
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-stone-600 dark:text-zinc-400">
              <div className="p-2 rounded-lg bg-stone-50 dark:bg-zinc-950/40 border border-stone-200/60 dark:border-zinc-800 flex items-center justify-between">
                <span>Escuchar / Reanudar:</span>
                <kbd className="px-1.5 py-0.5 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded text-[10px] font-mono text-stone-800 dark:text-zinc-200">
                  Alt + T
                </kbd>
              </div>
              <div className="p-2 rounded-lg bg-stone-50 dark:bg-zinc-950/40 border border-stone-200/60 dark:border-zinc-800 flex items-center justify-between">
                <span>Repetir en repaso:</span>
                <kbd className="px-1.5 py-0.5 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded text-[10px] font-mono text-stone-800 dark:text-zinc-200">
                  R
                </kbd>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SECTION: Apariencia */}
      <Card className="border border-stone-200 dark:border-zinc-800 rounded-2xl shadow-xs overflow-hidden bg-white dark:bg-zinc-900">
        <CardHeader className="bg-stone-50/60 dark:bg-zinc-950/40 border-b border-stone-200/80 dark:border-zinc-800 pb-3">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-zinc-400">
            Apariencia
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-5">
          <div>
            <label className="block text-[11px] font-semibold text-stone-600 dark:text-zinc-400 mb-1.5">
              Tema visual
            </label>
            <select
              value={theme}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTheme(e.target.value as any)}
              className="w-full rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50/60 dark:bg-zinc-800 px-3 py-2 text-xs font-medium text-stone-800 dark:text-zinc-200 focus:outline-none focus:border-blue-500"
            >
              <option value="light">Claro</option>
              <option value="dark">Oscuro</option>
              <option value="system">Seguir sistema</option>
            </select>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
