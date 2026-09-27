import React, { useState, useEffect } from 'react';
import { CardForReview } from '../../api/types';
import { Card, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Volume2, X, ArrowRight, RotateCcw } from 'lucide-react';
import { useTTS } from '../../hooks/useTTS';
import { charDiff, scoreSimilarity } from '../../lib/scoring';
import { RatingButtons } from './RatingButtons';

interface Props {
  card: CardForReview;
  onComplete: (rating: number) => void;
  onCancel: () => void;
}

export function DictationMode({ card, onComplete, onCancel }: Props) {
  const [input, setInput] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [suggestedRating, setSuggestedRating] = useState<number>(0);
  const [feedbackText, setFeedbackText] = useState<string>('');

  const [selectedLang, setSelectedLang] = useState<string>(card.fields['Language'] || 'auto');
  // In dictation mode, we dictate either the Front (or Sentence or Question)
  const textToDictate =
    card.fields['Sentence'] ||
    card.fields['Front'] ||
    card.fields['Question'] ||
    '';

  const { speak, isSpeaking } = useTTS(selectedLang, () => {
    speak(textToDictate, selectedLang);
  });

  useEffect(() => {
    setSelectedLang(card.fields['Language'] || 'auto');
  }, [card.card_id]);

  useEffect(() => {
    // Automatically play speech when entering dictation mode
    speak(textToDictate, selectedLang);
  }, [card.card_id, textToDictate, selectedLang, speak]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || showResult) return;

    const { rating, feedback } = scoreSimilarity(
      input.trim().toLowerCase(),
      textToDictate.trim().toLowerCase()
    );
    setSuggestedRating(rating);
    setFeedbackText(feedback);
    setShowResult(true);
  };

  const diff = showResult ? charDiff(input.trim(), textToDictate.trim()) : [];

  return (
    <Card className="min-h-[440px] flex flex-col justify-between shadow-xl border-2 border-emerald-500/30 dark:border-emerald-500/20 rounded-3xl overflow-hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-md">
      {/* Top action bar */}
      <div className="flex justify-between items-center px-6 pt-5 text-slate-400">
        <span className="text-xs uppercase tracking-wider font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
          Modo Dictado
        </span>
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
          <button
            onClick={onCancel}
            className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            title="Salir del modo dictado"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <CardContent className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-6">
        {/* Prominent audio replay button */}
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={() => speak(textToDictate, selectedLang)}
            className={`h-24 w-24 rounded-full flex items-center justify-center transition-all duration-300 shadow-md ${
              isSpeaking
                ? 'bg-emerald-500 text-white scale-110 shadow-emerald-500/30'
                : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-400 dark:hover:bg-emerald-900/60'
            }`}
            title="Reproducir audio (Alt+T o R)"
          >
            <Volume2 className="h-10 w-10" />
          </button>
          <span className="text-xs text-slate-400">Toca para escuchar de nuevo (Alt+T o R)</span>
        </div>

        {!showResult ? (
          <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribe lo que escuchas..."
              autoFocus
              className="text-lg py-3.5 px-4 text-center rounded-2xl border-2 focus:border-emerald-500 shadow-sm"
            />
            <Button
              type="submit"
              disabled={!input.trim()}
              className="w-full py-3.5 rounded-2xl text-base font-semibold flex items-center justify-center gap-2"
            >
              <span>Comprobar</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>
        ) : (
          <div className="w-full max-w-md space-y-4 animate-in fade-in duration-300">
            {/* Feedback badge */}
            <div
              className={`inline-block px-4 py-1.5 rounded-full text-sm font-semibold ${
                suggestedRating >= 3
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
              }`}
            >
              {feedbackText}
            </div>

            {/* Character diff view */}
            <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-lg font-mono tracking-wider flex flex-wrap justify-center gap-0.5">
              {diff.map((d, i) => {
                if (d.status === 'correct') {
                  return (
                    <span key={i} className="text-emerald-600 dark:text-emerald-400 font-bold">
                      {d.char}
                    </span>
                  );
                } else if (d.status === 'incorrect' || d.status === 'extra') {
                  return (
                    <span
                      key={i}
                      className="text-rose-600 dark:text-rose-400 line-through bg-rose-50 dark:bg-rose-950/50 px-0.5 rounded"
                    >
                      {d.char}
                    </span>
                  );
                } else {
                  return (
                    <span
                      key={i}
                      className="text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-950 px-1 rounded border border-amber-300 dark:border-amber-700"
                    >
                      {d.char}
                    </span>
                  );
                }
              })}
            </div>

            {/* Expected original text */}
            <div className="text-sm text-slate-500 dark:text-slate-400">
              Texto original: <strong className="text-slate-700 dark:text-slate-200">{textToDictate}</strong>
            </div>
          </div>
        )}
      </CardContent>

      {/* Rating buttons when result is shown */}
      {showResult && (
        <div className="p-4 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/60 backdrop-blur-sm">
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
