import React, { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useReviewStore } from '../stores/reviewStore';
import { ProgressBar } from '../components/ui/ProgressBar';
import { Button } from '../components/ui/Button';
import { ReviewSession } from '../components/review/ReviewSession';
import { CheckCircle2, RotateCcw, ArrowLeft, WifiOff } from 'lucide-react';

export default function ReviewPage() {
  const { deckId } = useParams<{ deckId: string }>();
  const {
    loadQueue,
    reset,
    cards,
    currentIndex,
    originalTotal,
    retriesQueued,
    isLoading,
    isOfflineMode,
    offlineReason,
    isSyncedBanner,
    sessionStats,
  } = useReviewStore();

  const numericDeckId = deckId ? parseInt(deckId, 10) : 0;

  useEffect(() => {
    if (numericDeckId) {
      loadQueue(numericDeckId);
    }
    return () => reset();
  }, [numericDeckId, loadQueue, reset]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 space-y-4">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-stone-500 dark:text-zinc-400 text-xs font-medium">Preparando sesión de estudio...</span>
      </div>
    );
  }

  // Session complete or empty queue
  if (cards.length === 0 || currentIndex >= cards.length) {
    const totalAnswered = sessionStats.correct + sessionStats.incorrect;
    const accuracy = totalAnswered > 0 ? Math.round((sessionStats.correct / totalAnswered) * 100) : 100;

    return (
      <div className="max-w-md mx-auto text-center space-y-6 py-12 px-6">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200/60 dark:border-blue-900/40">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-xl font-semibold tracking-tight text-stone-900 dark:text-zinc-100">
            Sesión completada
          </h2>
          <p className="text-xs text-stone-500 dark:text-zinc-400 max-w-xs mx-auto">
            Has repasado todas las tarjetas programadas para este mazo.
          </p>
        </div>

        {totalAnswered > 0 && (
          <div className="grid grid-cols-3 gap-3 p-4 rounded-xl bg-stone-50/70 dark:bg-zinc-800/50 border border-stone-200/80 dark:border-zinc-800">
            <div>
              <div className="text-xl font-semibold tracking-tight text-stone-900 dark:text-zinc-100">
                {totalAnswered}
              </div>
              <div className="text-[11px] text-stone-400 dark:text-zinc-500">Repasadas</div>
            </div>
            <div>
              <div className="text-xl font-semibold tracking-tight text-emerald-600 dark:text-emerald-400">
                {sessionStats.correct}
              </div>
              <div className="text-[11px] text-stone-400 dark:text-zinc-500">Aprobadas</div>
            </div>
            <div>
              <div className="text-xl font-semibold tracking-tight text-blue-600 dark:text-blue-400">
                {accuracy}%
              </div>
              <div className="text-[11px] text-stone-400 dark:text-zinc-500">Acierto</div>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2.5 justify-center pt-2">
          <Button
            variant="secondary"
            onClick={() => loadQueue(numericDeckId)}
            className="flex items-center justify-center gap-2 text-xs font-medium"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Repasar de nuevo</span>
          </Button>
          <Link to="/">
            <Button className="w-full sm:w-auto flex items-center justify-center gap-2 text-xs font-medium">
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Volver a mazos</span>
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const effectiveTotal = originalTotal > 0 ? originalTotal : cards.length;
  const progress = effectiveTotal > 0 ? Math.min(100, (currentIndex / effectiveTotal) * 100) : 0;
  const displayCurrent = Math.min(currentIndex + 1, effectiveTotal);

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Offline banner if in local offline review mode */}
      {isOfflineMode ? (
        <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-900/40 text-amber-700 dark:text-amber-400 text-xs font-medium">
          <WifiOff className="h-3.5 w-3.5 shrink-0" />
          <span>{offlineReason || "No se pudo conectar a tu servidor — estudiando con tu última descarga."}</span>
        </div>
      ) : isSyncedBanner && (
        <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-xs font-medium transition-all">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          <span>✅ Sincronizado — tus respuestas locales se subieron al servidor exitosamente.</span>
        </div>
      )}

      {/* Progress bar and counter */}
      <div className="space-y-1.5 px-0.5">
        <ProgressBar progress={progress} />
        <div className="flex justify-between items-center text-[11px] text-stone-400 dark:text-zinc-500 font-mono">
          <div className="flex items-center gap-2">
            <span>Tarjeta {displayCurrent} de {effectiveTotal}</span>
            {retriesQueued > 0 && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-medium border border-amber-500/20 font-sans tracking-tight">
                <RotateCcw className="h-2.5 w-2.5" />
                <span>+{retriesQueued} por repetir</span>
              </span>
            )}
          </div>
          <span>{Math.round(progress)}% completado</span>
        </div>
      </div>

      {/* Card reviewer session */}
      <ReviewSession />
    </div>
  );
}
