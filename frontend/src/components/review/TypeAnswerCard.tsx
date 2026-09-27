import React, { useState, useEffect } from 'react';
import { CardForReview } from '../../api/types';
import { Card, CardContent } from '../ui/Card';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { charDiff, scoreSimilarity } from '../../lib/scoring';
import { RatingButtons } from './RatingButtons';
import { useTTS } from '../../hooks/useTTS';
import { useKeyboard } from '../../hooks/useKeyboard';
import { Volume2, ArrowRight } from 'lucide-react';

interface Props {
  card: CardForReview;
  onComplete: (rating: number) => void;
  onToggleDictation?: () => void;
}

export function TypeAnswerCard({ card, onComplete, onToggleDictation }: Props) {
  const [input, setInput] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [suggestedRating, setSuggestedRating] = useState<number>(0);
  const [feedbackText, setFeedbackText] = useState<string>('');

  const [selectedLang, setSelectedLang] = useState<string>(card.fields['Language'] || 'auto');
  const frontText = card.fields['Front'] || card.fields['Question'] || '';
  const expected = card.fields['Back'] || card.fields['Answer'] || '';

  // Reset local state completely whenever a new card is loaded
  useEffect(() => {
    setInput('');
    setShowResult(false);
    setSuggestedRating(0);
    setFeedbackText('');
    setSelectedLang(card.fields['Language'] || 'auto');
  }, [card.card_id]);

  const { speak, isSpeaking } = useTTS(selectedLang, () => {
    speak(frontText, selectedLang);
  });

  useKeyboard({
    '1': () => showResult && onComplete(1),
    '2': () => showResult && onComplete(2),
    '3': () => showResult && onComplete(3),
    '4': () => showResult && onComplete(4),
    'Enter': () => showResult && onComplete(suggestedRating || 1),
    'Space': () => showResult && onComplete(suggestedRating || 1),
  }, [showResult, onComplete, suggestedRating]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || showResult) return;

    const { rating, feedback } = scoreSimilarity(
      input.trim().toLowerCase(),
      expected.trim().toLowerCase()
    );
    setSuggestedRating(rating);
    setFeedbackText(feedback);
    setShowResult(true);
  };

  const diff = showResult ? charDiff(input.trim(), expected.trim()) : [];

  return (
    <Card className="min-h-[420px] flex flex-col justify-between shadow-sm border border-stone-200 dark:border-zinc-800 rounded-2xl overflow-hidden bg-white dark:bg-zinc-900">
      {/* Top action bar */}
      <div className="flex justify-between items-center px-6 pt-5 text-stone-400 dark:text-zinc-500">
        <span className="text-[11px] uppercase tracking-wider font-semibold text-stone-400 dark:text-zinc-500">
          Teclear Respuesta
        </span>
        <div className="flex items-center gap-2">
          {/* Selector de idioma */}
          <select
            value={selectedLang}
            onChange={(e) => setSelectedLang(e.target.value)}
            className="text-[11px] font-medium bg-stone-100 dark:bg-zinc-800 text-stone-600 dark:text-zinc-300 rounded-lg px-2 py-1 border border-stone-200 dark:border-zinc-700 outline-none cursor-pointer hover:border-blue-500"
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
            onClick={() => speak(frontText, selectedLang)}
            className={`p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors pressable ${
              isSpeaking ? 'text-blue-600 dark:text-blue-400 animate-pulse' : 'text-stone-500 dark:text-zinc-400'
            }`}
            title="Escuchar audio (Alt+T o R)"
          >
            <Volume2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <CardContent className="flex-1 flex flex-col items-center justify-center p-8 sm:p-12 text-center space-y-6">
        {/* Front Question */}
        <div
          className="text-2xl sm:text-3xl font-medium tracking-tight text-stone-900 dark:text-zinc-100 max-w-lg leading-relaxed"
          dangerouslySetInnerHTML={{ __html: frontText }}
        />

        {!showResult ? (
          <form onSubmit={handleSubmit} className="w-full max-w-md space-y-3">
            <div className="relative">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Escribe tu respuesta..."
                autoFocus
                className="text-base sm:text-lg py-2.5 px-4 text-center rounded-xl border border-stone-200 dark:border-zinc-700 focus:border-blue-600 font-medium"
              />
            </div>
            <Button
              type="submit"
              disabled={!input.trim()}
              className="w-full py-2.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2"
            >
              <span>Comprobar</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </form>
        ) : (
          <div className="w-full max-w-md space-y-3.5 animate-in fade-in duration-200">
            {/* Feedback badge */}
            <div
              className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                suggestedRating >= 3
                  ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40'
                  : 'bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40'
              }`}
            >
              {feedbackText}
            </div>

            {/* Character diff view */}
            <div className="p-3.5 rounded-xl bg-stone-100/70 dark:bg-zinc-800/60 border border-stone-200 dark:border-zinc-700/80 text-base font-mono tracking-wider flex flex-wrap justify-center gap-0.5">
              {diff.map((d, i) => {
                if (d.status === 'correct') {
                  return (
                    <span key={i} className="text-emerald-600 dark:text-emerald-400 font-semibold">
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
                      className="text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-0.5 rounded border border-amber-200 dark:border-amber-800"
                    >
                      {d.char}
                    </span>
                  );
                }
              })}
            </div>

            {/* Expected text */}
            <div className="text-xs text-stone-500 dark:text-zinc-400">
              Respuesta correcta: <strong className="text-stone-800 dark:text-zinc-200">{expected}</strong>
            </div>
          </div>
        )}
      </CardContent>

      {/* Rating buttons when result is shown */}
      {showResult && (
        <div className="p-4 border-t border-stone-200/80 dark:border-zinc-800 bg-stone-50/60 dark:bg-zinc-950/40">
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
