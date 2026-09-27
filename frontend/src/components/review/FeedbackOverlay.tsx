import React from 'react';
import { CheckCircle, XCircle } from 'lucide-react';

export function FeedbackOverlay({ status }: { status: 'correct' | 'incorrect' }) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none animate-in fade-in duration-150">
      <div className="bg-white/95 dark:bg-zinc-900/95 rounded-xl px-5 py-3 shadow-lg border border-stone-200 dark:border-zinc-800 backdrop-blur-xs flex items-center gap-2.5">
        {status === 'correct' ? (
          <>
            <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <span className="text-xs font-semibold text-stone-800 dark:text-zinc-200">¡Correcto!</span>
          </>
        ) : (
          <>
            <XCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
            <span className="text-xs font-semibold text-stone-800 dark:text-zinc-200">Incorrecto</span>
          </>
        )}
      </div>
    </div>
  );
}
