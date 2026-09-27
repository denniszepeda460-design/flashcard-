import React, { useState, useEffect, useRef } from 'react';
import { CardForReview } from '../../api/types';
import { Card, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Volume2, ArrowRight, Sparkles, HelpCircle, Eye, EyeOff } from 'lucide-react';
import { useTTS } from '../../hooks/useTTS';
import { useKeyboard } from '../../hooks/useKeyboard';
import { charDiff, scoreSimilarity } from '../../lib/scoring';
import { RatingButtons } from './RatingButtons';

interface Props {
  card: CardForReview;
  onComplete: (rating: number) => void;
}

export function DictationCard({ card, onComplete }: Props) {
  const [input, setInput] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [suggestedRating, setSuggestedRating] = useState<number>(0);
  const [feedbackText, setFeedbackText] = useState<string>('');
  const [showHint, setShowHint] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [selectedLang, setSelectedLang] = useState<string>(card.fields['Language'] || 'auto');
  const audioText =
    card.fields['AudioText'] ||
    card.fields['Sentence'] ||
    card.fields['Front'] ||
    card.fields['Question'] ||
    '';
  const translationHint = card.fields['Translation'] || card.fields['Pista'] || '';

  // Reset state completely when moving to a new card
  useEffect(() => {
    setInput('');
    setShowResult(false);
    setSuggestedRating(0);
    setFeedbackText('');
    setShowHint(false);
    setSelectedLang(card.fields['Language'] || 'auto');
  }, [card.card_id]);

  const { speak, isSpeaking } = useTTS(selectedLang, () => {
    speak(audioText, selectedLang);
  });

  // Auto-play audio when card loads
  useEffect(() => {
    if (audioText) {
      speak(audioText, selectedLang);
    }
  }, [card.card_id, audioText, selectedLang, speak]);

  // Focus input when loaded
  useEffect(() => {
    if (!showResult && inputRef.current) {
      inputRef.current.focus();
    }
  }, [card.card_id, showResult]);

  useKeyboard(
    {
      '1': () => showResult && onComplete(1),
      '2': () => showResult && onComplete(2),
      '3': () => showResult && onComplete(3),
      '4': () => showResult && onComplete(4),
      'Space': () => showResult && onComplete(suggestedRating || 3),
    },
    [showResult, onComplete, suggestedRating]
  );

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || showResult) return;

    const { rating, feedback } = scoreSimilarity(
      input.trim().toLowerCase(),
      audioText.trim().toLowerCase()
    );
    setSuggestedRating(rating);
    setFeedbackText(feedback);
    setShowResult(true);
  };

  const diff = showResult ? charDiff(input.trim(), audioText.trim()) : [];

  return (
    <Card className="min-h-[460px] flex flex-col justify-between shadow-xs border border-stone-200 dark:border-zinc-800 rounded-2xl overflow-hidden bg-white dark:bg-zinc-900 transition-colors">
      {/* Top action bar */}
      <div className="flex justify-between items-center px-6 pt-5 text-stone-400 dark:text-zinc-500">
        <div className="flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-wider font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
            Dictado · Escuchar y Escribir
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Selector de idioma */}
          <select
            value={selectedLang}
            onChange={(e) => setSelectedLang(e.target.value)}
            className="text-[11px] font-medium bg-stone-100 dark:bg-zinc-800 text-stone-600 dark:text-zinc-300 rounded-lg px-2 py-1 border border-stone-200 dark:border-zinc-700 outline-none cursor-pointer hover:border-emerald-500"
            title="Seleccionar idioma o autodetección"
          >
            <option value="auto">🌐 Auto</option>
            <option value="es-ES">🇪🇸 ES</option>
            <option value="en-US">🇺🇸 EN</option>
            <option value="de-DE">🇩🇪 DE</option>
            <option value="fr-FR">🇫🇷 FR</option>
            <option value="it-IT">🇮🇹 IT</option>
          </select>

          {translationHint && (
            <button
              type="button"
              onClick={() => setShowHint(!showHint)}
              className="px-2.5 py-1 rounded-lg text-xs font-medium text-stone-500 hover:text-stone-800 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-stone-100 dark:hover:bg-zinc-800 flex items-center gap-1 transition-colors pressable"
              title="Mostrar u ocultar pista de traducción"
            >
              {showHint ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              <span>{showHint ? 'Ocultar pista' : 'Ver pista'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => speak(audioText, selectedLang)}
            className={`p-1.5 rounded-lg transition-colors pressable ${
              isSpeaking
                ? 'bg-emerald-500 text-white shadow-xs'
                : 'hover:bg-stone-100 dark:hover:bg-zinc-800 text-stone-500 dark:text-zinc-400'
            }`}
            title="Escuchar audio (Alt+T o R)"
          >
            <Volume2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <CardContent className="flex-1 flex flex-col items-center justify-center p-6 sm:p-8 text-center space-y-6">
        {/* Prominent Speaker Button */}
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => speak(audioText, selectedLang)}
            className={`h-24 w-24 sm:h-28 sm:w-28 rounded-3xl flex items-center justify-center transition-all duration-300 pressable shadow-md ${
              isSpeaking
                ? 'bg-emerald-600 text-white scale-105 shadow-emerald-500/25 ring-4 ring-emerald-500/20'
                : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-200/80 dark:border-emerald-800/50'
            }`}
            title="Haz clic para escuchar el audio (Atajo: Alt+T o R)"
          >
            <Volume2 className={`h-12 w-12 sm:h-14 sm:w-14 transition-transform ${isSpeaking ? 'scale-110' : ''}`} />
          </button>
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-xs font-semibold text-stone-700 dark:text-zinc-300">
              {isSpeaking ? 'Reproduciendo audio...' : 'Haz clic o pulsa Alt+T para escuchar'}
            </span>
            <span className="text-[11px] text-stone-400 dark:text-zinc-500">
              Escucha con atención y escribe lo que oigas
            </span>
          </div>
        </div>

        {/* Translation hint if requested */}
        {translationHint && showHint && (
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 text-xs text-amber-800 dark:text-amber-300 max-w-md animate-in fade-in">
            <span className="font-semibold">Pista:</span> {translationHint}
          </div>
        )}

        {/* Input or Result Section */}
        {!showResult ? (
          <form onSubmit={handleSubmit} className="w-full max-w-md space-y-3.5">
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Escribe lo que escuchas..."
                className="w-full text-center py-3 px-4 rounded-xl border border-stone-300 dark:border-zinc-700 bg-stone-50/50 dark:bg-zinc-950/50 text-stone-900 dark:text-zinc-100 text-base font-medium focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all shadow-xs"
                autoComplete="off"
                autoCorrect="off"
                spellCheck="false"
              />
            </div>
            <Button
              type="submit"
              disabled={!input.trim()}
              className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
            >
              <span>Comprobar respuesta</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>
        ) : (
          <div className="w-full max-w-md space-y-4 animate-in fade-in duration-300">
            {/* Feedback badge */}
            <div
              className={`inline-block px-3.5 py-1 rounded-full text-xs font-semibold ${
                suggestedRating >= 3
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40'
                  : 'bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40'
              }`}
            >
              {feedbackText}
            </div>

            {/* Character diff display */}
            <div className="p-3.5 rounded-xl bg-stone-50 dark:bg-zinc-950/60 border border-stone-200 dark:border-zinc-800 text-base font-mono tracking-wide flex flex-wrap justify-center gap-0.5">
              {diff.map((d, i) => {
                if (d.status === 'correct') {
                  return (
                    <span key={i} className="text-emerald-700 dark:text-emerald-400 font-bold">
                      {d.char}
                    </span>
                  );
                } else if (d.status === 'incorrect' || d.status === 'extra') {
                  return (
                    <span
                      key={i}
                      className="text-rose-600 dark:text-rose-400 line-through bg-rose-50 dark:bg-rose-950/60 px-0.5 rounded"
                    >
                      {d.char}
                    </span>
                  );
                } else {
                  return (
                    <span
                      key={i}
                      className="text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-1 rounded border border-amber-200 dark:border-amber-800/60"
                    >
                      {d.char}
                    </span>
                  );
                }
              })}
            </div>

            {/* Expected original text */}
            <div className="space-y-1">
              <div className="text-xs text-stone-500 dark:text-zinc-400">
                Texto correcto: <strong className="text-stone-900 dark:text-zinc-100 font-medium">{audioText}</strong>
              </div>
              {translationHint && (
                <div className="text-xs text-stone-400 dark:text-zinc-500">
                  Traducción: {translationHint}
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>

      {/* Spaced repetition rating buttons */}
      {showResult && (
        <div className="p-4 border-t border-stone-100 dark:border-zinc-800/80 bg-stone-50/50 dark:bg-zinc-950/40">
          <RatingButtons
            onRate={onComplete}
            suggested={suggestedRating}
            intervals={card.scheduling_states}
          />
        </div>
      )}
    </Card>
  );
}
