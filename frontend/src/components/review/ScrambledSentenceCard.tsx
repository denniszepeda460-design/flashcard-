import React, { useState, useEffect } from 'react';
import { CardForReview } from '../../api/types';
import { Card, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { tokenize, shuffleTokens } from '../../lib/scramble';
import { scoreScrambled } from '../../lib/scoring';
import { RatingButtons } from './RatingButtons';
import { useTTS } from '../../hooks/useTTS';
import { Volume2, Check } from 'lucide-react';

interface Props {
  card: CardForReview;
  onComplete: (rating: number) => void;
  onToggleDictation?: () => void;
}

export function ScrambledSentenceCard({ card, onComplete, onToggleDictation }: Props) {
  const [selectedLang, setSelectedLang] = useState<string>(card.fields['Language'] || 'auto');
  const targetSentence = card.fields['Sentence'] || card.fields['Back'] || '';
  const clueTranslation = card.fields['Translation'] || card.fields['Front'] || '';

  const [tokens, setTokens] = useState<string[]>([]);
  const [selectedTokens, setSelectedTokens] = useState<string[]>([]);
  const [availableTokens, setAvailableTokens] = useState<{ id: number; text: string }[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [rating, setRating] = useState<number>(0);

  const { speak, isSpeaking } = useTTS(selectedLang, () => {
    if (clueTranslation) speak(clueTranslation, selectedLang);
  });

  useEffect(() => {
    const rawTokens = tokenize(targetSentence);
    setTokens(rawTokens);
    const shuffled = shuffleTokens(rawTokens).map((text, idx) => ({ id: idx, text }));
    setAvailableTokens(shuffled);
    setSelectedTokens([]);
    setShowResult(false);
    setSelectedLang(card.fields['Language'] || 'auto');
  }, [card.card_id, targetSentence]);

  const selectToken = (tokenObj: { id: number; text: string }) => {
    if (showResult) return;
    setSelectedTokens([...selectedTokens, tokenObj.text]);
    setAvailableTokens(availableTokens.filter((t) => t.id !== tokenObj.id));
  };

  const deselectToken = (index: number) => {
    if (showResult) return;
    const tokenText = selectedTokens[index];
    const newSelected = [...selectedTokens];
    newSelected.splice(index, 1);
    setSelectedTokens(newSelected);
    setAvailableTokens([...availableTokens, { id: Date.now() + Math.random(), text: tokenText }]);
  };

  const handleCheck = () => {
    const res = scoreScrambled(selectedTokens, tokens);
    setRating(res.rating);
    setShowResult(true);
  };

  return (
    <Card className="min-h-[460px] flex flex-col justify-between shadow-sm border border-stone-200 dark:border-zinc-800 rounded-2xl overflow-hidden bg-white dark:bg-zinc-900">
      {/* Top action bar */}
      <div className="flex justify-between items-center px-6 pt-5 text-stone-400 dark:text-zinc-500">
        <span className="text-[11px] uppercase tracking-wider font-semibold text-stone-400 dark:text-zinc-500">
          Oraciones Desordenadas
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
            onClick={() => {
              if (clueTranslation) speak(clueTranslation, selectedLang);
            }}
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
        {/* Instruction and Clue */}
        <div className="text-center space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 dark:text-zinc-500">
            Ordena las palabras
          </p>
          {clueTranslation && (
            <div
              className="text-xl sm:text-2xl font-medium tracking-tight text-stone-900 dark:text-zinc-100 leading-relaxed max-w-lg mx-auto"
              dangerouslySetInnerHTML={{ __html: clueTranslation }}
            />
          )}
        </div>

        {/* Selected Tokens (Answer Area) */}
        <div className="min-h-[84px] p-3.5 rounded-xl border border-dashed border-stone-300 dark:border-zinc-700 flex flex-wrap gap-2 items-center justify-center bg-stone-50/60 dark:bg-zinc-950/40">
          {selectedTokens.map((text, i) => (
            <button
              key={i}
              onClick={() => deselectToken(i)}
              className="px-3.5 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-900/50 font-medium text-sm sm:text-base pressable shadow-2xs"
            >
              {text}
            </button>
          ))}
          {selectedTokens.length === 0 && (
            <span className="text-xs text-stone-400 dark:text-zinc-500">
              Toca las palabras de abajo en el orden correcto
            </span>
          )}
        </div>

        {/* Available Tokens (Word Bank) */}
        {!showResult ? (
          <div className="flex flex-wrap gap-2 justify-center mt-auto py-2">
            {availableTokens.map((t) => (
              <button
                key={t.id}
                onClick={() => selectToken(t)}
                className="px-3.5 py-2 rounded-lg bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 shadow-2xs font-medium text-sm sm:text-base hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50/20 text-stone-800 dark:text-zinc-200 pressable"
              >
                {t.text}
              </button>
            ))}
          </div>
        ) : (
          <div className="text-center mt-auto space-y-2.5 animate-in fade-in duration-200">
            <div
              className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                rating === 3
                  ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40'
                  : 'bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40'
              }`}
            >
              {rating === 3 ? '¡Excelente!' : 'Casi, la oración correcta es:'}
            </div>
            <div className="text-base sm:text-lg font-medium text-stone-900 dark:text-zinc-100 bg-stone-100/70 dark:bg-zinc-800/60 p-3.5 rounded-xl border border-stone-200 dark:border-zinc-700">
              {targetSentence}
            </div>
          </div>
        )}

        {!showResult && selectedTokens.length > 0 && availableTokens.length === 0 && (
          <Button
            onClick={handleCheck}
            className="w-full py-2.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 mt-3"
          >
            <Check className="h-4 w-4" />
            <span>Comprobar</span>
          </Button>
        )}
      </CardContent>

      {/* Result ratings */}
      {showResult && (
        <div className="p-4 border-t border-stone-200/80 dark:border-zinc-800 bg-stone-50/60 dark:bg-zinc-950/40">
          <RatingButtons
            onRate={onComplete}
            suggested={rating}
            intervals={card.scheduling_states}
          />
        </div>
      )}
    </Card>
  );
}
