import React, { useState, useEffect } from 'react';
import { CardForReview } from '../../api/types';
import { Card, CardContent } from '../ui/Card';
import { RatingButtons } from './RatingButtons';
import { useKeyboard } from '../../hooks/useKeyboard';
import { useTTS } from '../../hooks/useTTS';
import { Volume2 } from 'lucide-react';

interface Props {
  card: CardForReview;
  onComplete: (rating: number) => void;
  onToggleDictation?: () => void;
}

export function BasicCard({ card, onComplete, onToggleDictation }: Props) {
  const [showAnswer, setShowAnswer] = useState(false);
  const [selectedLang, setSelectedLang] = useState<string>(card.fields['Language'] || 'auto');
  const frontText = card.fields['Front'] || card.fields['Question'] || '';
  const backText = card.fields['Back'] || card.fields['Answer'] || '';

  useEffect(() => {
    setShowAnswer(false);
    setSelectedLang(card.fields['Language'] || 'auto');
  }, [card.card_id]);

  const { speak, isSpeaking } = useTTS(selectedLang, () => {
    speak(frontText, selectedLang);
  });

  useKeyboard({
    'Space': () => {
      if (!showAnswer) setShowAnswer(true);
    },
    '1': () => showAnswer && onComplete(1),
    '2': () => showAnswer && onComplete(2),
    '3': () => showAnswer && onComplete(3),
    '4': () => showAnswer && onComplete(4),
  }, [showAnswer, onComplete]);

  return (
    <Card className="min-h-[420px] flex flex-col justify-between shadow-sm border border-stone-200 dark:border-zinc-800 rounded-2xl overflow-hidden bg-white dark:bg-zinc-900">
      {/* Top action bar */}
      <div className="flex justify-between items-center px-6 pt-5 text-stone-400 dark:text-zinc-500">
        <span className="text-[11px] uppercase tracking-wider font-semibold text-stone-400 dark:text-zinc-500">
          {card.note_type_name.includes('reversed') ? 'Básica Invertida' : 'Básica'}
        </span>
        <div className="flex items-center gap-2">
          {/* Menú desplegable rápido de idioma */}
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

      <CardContent className="flex-1 flex flex-col items-center justify-center p-8 sm:p-12 text-center">
        {/* Front Question */}
        <div
          className="text-2xl sm:text-3xl font-medium tracking-tight text-stone-900 dark:text-zinc-100 max-w-lg leading-relaxed"
          dangerouslySetInnerHTML={{ __html: frontText }}
        />

        {/* Separator & Answer */}
        {showAnswer && (
          <div className="w-full max-w-lg mt-8 pt-8 border-t border-stone-200/80 dark:border-zinc-800 animate-in fade-in duration-200">
            <div
              className="text-xl sm:text-2xl font-normal text-blue-700 dark:text-blue-300 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: backText }}
            />
          </div>
        )}
      </CardContent>

      {/* Bottom control bar */}
      <div className="p-4 border-t border-stone-200/80 dark:border-zinc-800 bg-stone-50/60 dark:bg-zinc-950/40">
        {!showAnswer ? (
          <button
            type="button"
            className="w-full py-3 px-6 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium rounded-xl transition-all shadow-xs pressable flex items-center justify-center gap-2"
            onClick={() => setShowAnswer(true)}
          >
            <span className="text-sm font-semibold">Mostrar Respuesta</span>
            <span className="text-[11px] bg-blue-700/80 px-2 py-0.5 rounded-md font-mono hidden sm:inline">
              Espacio
            </span>
          </button>
        ) : (
          <RatingButtons
            onRate={onComplete}
            intervals={card.scheduling_states}
          />
        )}
      </div>
    </Card>
  );
}
