import React, { useState, useEffect, useMemo } from 'react';
import { CardForReview } from '../../api/types';
import { Card, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { FeedbackOverlay } from './FeedbackOverlay';
import { useTTS } from '../../hooks/useTTS';
import { Volume2 } from 'lucide-react';

interface Props {
  card: CardForReview;
  onComplete: (rating: number) => void;
  onToggleDictation?: () => void;
}

export function MultipleChoiceCard({ card, onComplete, onToggleDictation }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState<'correct' | 'incorrect' | null>(null);

  useEffect(() => {
    setSelected(null);
    setShowFeedback(null);
    setSelectedLang(card.fields['Language'] || 'auto');
  }, [card.card_id]);

  const [selectedLang, setSelectedLang] = useState<string>(card.fields['Language'] || 'auto');
  const question = card.fields['Question'] || card.fields['Front'] || '';
  const correctAnswer = card.fields['CorrectAnswer'] || card.fields['Back'] || '';

  const { speak, isSpeaking } = useTTS(selectedLang, () => {
    speak(question, selectedLang);
  });

  const options = useMemo(() => {
    const wrongFields = [
      card.fields['WrongAnswer1'],
      card.fields['WrongAnswer2'],
      card.fields['WrongAnswer3'],
      card.fields['Wrong1'],
      card.fields['Wrong2'],
      card.fields['Wrong3'],
    ].filter((w): w is string => Boolean(w && w.trim()));

    // Fallbacks if not enough options
    const defaultOptions = ['Opción A', 'Opción B', 'Opción C'];
    const candidates = wrongFields.length > 0 ? wrongFields : defaultOptions;

    const all = [correctAnswer, ...candidates.filter(c => c !== correctAnswer)];
    return all.sort(() => Math.random() - 0.5);
  }, [card.card_id, correctAnswer]);

  const handleSelect = (opt: string) => {
    if (selected) return;
    setSelected(opt);

    const isCorrect = opt.trim().toLowerCase() === correctAnswer.trim().toLowerCase();
    setShowFeedback(isCorrect ? 'correct' : 'incorrect');

    setTimeout(() => {
      onComplete(isCorrect ? 3 : 1);
    }, 1100);
  };

  return (
    <div className="relative">
      <Card className="min-h-[420px] flex flex-col justify-between shadow-sm border border-stone-200 dark:border-zinc-800 rounded-2xl overflow-hidden bg-white dark:bg-zinc-900">
        {/* Top action bar */}
        <div className="flex justify-between items-center px-6 pt-5 text-stone-400 dark:text-zinc-500">
          <span className="text-[11px] uppercase tracking-wider font-semibold text-stone-400 dark:text-zinc-500">
            Opción Múltiple
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
              onClick={() => speak(question, selectedLang)}
              className={`p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors pressable ${
                isSpeaking ? 'text-blue-600 dark:text-blue-400 animate-pulse' : 'text-stone-500 dark:text-zinc-400'
              }`}
              title="Escuchar audio (Alt+T o R)"
            >
              <Volume2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        <CardContent className="flex-1 flex flex-col p-6 sm:p-8 space-y-6">
          {/* Question text */}
          <div
            className="text-2xl sm:text-3xl font-medium tracking-tight text-center text-stone-900 dark:text-zinc-100 my-auto leading-relaxed max-w-lg mx-auto"
            dangerouslySetInnerHTML={{ __html: question }}
          />

          {/* Options buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-auto">
            {options.map((opt, i) => {
              const isSelected = selected === opt;
              const isCorrect = opt.trim().toLowerCase() === correctAnswer.trim().toLowerCase();

              let btnStyle =
                'border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-stone-800 dark:text-zinc-200 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50/20 dark:hover:bg-blue-950/20 shadow-2xs';

              let letterBadgeStyle =
                'bg-stone-100 dark:bg-zinc-800 text-stone-600 dark:text-zinc-300 border border-stone-200 dark:border-zinc-700';

              if (selected) {
                if (isCorrect) {
                  btnStyle =
                    'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 ring-1 ring-emerald-500/50 shadow-2xs';
                  letterBadgeStyle = 'bg-emerald-500 text-white border-emerald-600';
                } else if (isSelected) {
                  btnStyle =
                    'border-rose-500 bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 ring-1 ring-rose-500/50 shadow-2xs';
                  letterBadgeStyle = 'bg-rose-500 text-white border-rose-600';
                } else {
                  btnStyle = 'opacity-35 border-stone-200 dark:border-zinc-800 bg-stone-50/50 dark:bg-zinc-900/50';
                }
              }

              return (
                <button
                  key={i}
                  className={`w-full p-3.5 sm:p-4 rounded-xl border text-left text-sm sm:text-base font-medium transition-all duration-150 flex items-center gap-3 pressable ${btnStyle}`}
                  onClick={() => handleSelect(opt)}
                  disabled={Boolean(selected)}
                >
                  <span
                    className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono text-xs font-semibold shrink-0 transition-colors ${letterBadgeStyle}`}
                  >
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className="flex-1 leading-snug">{opt}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {showFeedback && <FeedbackOverlay status={showFeedback} />}
    </div>
  );
}
