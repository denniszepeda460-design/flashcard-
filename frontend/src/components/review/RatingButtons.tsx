import React from 'react';

interface Props {
  onRate: (rating: number) => void;
  suggested?: number;
  intervals?: Record<string, string>;
}

export function RatingButtons({ onRate, suggested, intervals }: Props) {
  const buttons = [
    {
      rating: 1,
      key: '1',
      label: 'De nuevo',
      interval: intervals?.again || '1m',
      bg: 'hover:bg-rose-50/60 dark:hover:bg-rose-950/30 text-rose-700 dark:text-rose-400',
      border: 'border-stone-200 dark:border-zinc-800 hover:border-rose-300 dark:hover:border-rose-900/60',
    },
    {
      rating: 2,
      key: '2',
      label: 'Difícil',
      interval: intervals?.hard || '6m',
      bg: 'hover:bg-amber-50/60 dark:hover:bg-amber-950/30 text-amber-700 dark:text-amber-400',
      border: 'border-stone-200 dark:border-zinc-800 hover:border-amber-300 dark:hover:border-amber-900/60',
    },
    {
      rating: 3,
      key: '3',
      label: 'Bien',
      interval: intervals?.good || '10m',
      bg: 'hover:bg-blue-50/60 dark:hover:bg-blue-950/30 text-stone-800 dark:text-zinc-200 hover:text-blue-700 dark:hover:text-blue-400',
      border: 'border-stone-200 dark:border-zinc-800 hover:border-blue-300 dark:hover:border-blue-900/60',
    },
    {
      rating: 4,
      key: '4',
      label: 'Fácil',
      interval: intervals?.easy || '4d',
      bg: 'hover:bg-blue-50/60 dark:hover:bg-blue-950/30 text-blue-700 dark:text-blue-400',
      border: 'border-stone-200 dark:border-zinc-800 hover:border-blue-300 dark:hover:border-blue-900/60',
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-2">
      {buttons.map((b) => {
        const isSuggested = suggested === b.rating;

        return (
          <button
            key={b.rating}
            type="button"
            onClick={() => onRate(b.rating)}
            className={`relative flex flex-col items-center justify-center py-2.5 px-1 rounded-xl border bg-white dark:bg-zinc-900 transition-all duration-150 pressable ${b.bg} ${b.border} ${
              isSuggested
                ? 'ring-2 ring-blue-600/40 dark:ring-blue-500/40 border-blue-500 shadow-2xs font-semibold'
                : 'shadow-2xs'
            }`}
          >
            <span className="font-medium text-xs sm:text-sm">{b.label}</span>
            <span className="text-[10px] text-stone-400 dark:text-zinc-500 font-mono mt-0.5">{b.interval}</span>
            <span className="text-[9px] text-stone-400 dark:text-zinc-600 absolute top-1 right-1.5 hidden sm:inline font-mono">
              {b.key}
            </span>
          </button>
        );
      })}
    </div>
  );
}
