import React, { useEffect, useState } from 'react';
import { Card } from '../components/ui/Card';
import { fetchTodayStats } from '../api/stats';
import { TodayStats } from '../api/types';
import { Flame, CheckCircle2, TrendingUp, Sparkles, BookOpen } from 'lucide-react';

export default function StatsPage() {
  const [stats, setStats] = useState<TodayStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchTodayStats()
      .then(setStats)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-stone-900 dark:text-zinc-50">
          Estadísticas y Progreso
        </h1>
        <p className="text-xs sm:text-sm text-stone-500 dark:text-zinc-400 mt-1">
          Rendimiento y retención de memoria gestionados con FSRS
        </p>
      </div>

      {isLoading && (
        <div className="text-center py-12 text-stone-400 dark:text-zinc-500 text-xs">Cargando estadísticas...</div>
      )}

      {stats && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border border-stone-200 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-900 shadow-xs p-5 space-y-2">
            <div className="flex items-center justify-between text-stone-400 dark:text-zinc-500">
              <span className="text-[11px] uppercase tracking-wider font-semibold">Racha actual</span>
              <Flame className="h-4 w-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold tracking-tight text-stone-900 dark:text-zinc-50">
              {stats.streak_days} {stats.streak_days === 1 ? 'día' : 'días'}
            </div>
            <p className="text-[11px] text-stone-400 dark:text-zinc-400">Días consecutivos estudiando</p>
          </Card>

          <Card className="border border-stone-200 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-900 shadow-xs p-5 space-y-2">
            <div className="flex items-center justify-between text-stone-400 dark:text-zinc-500">
              <span className="text-[11px] uppercase tracking-wider font-semibold">Repasos hoy</span>
              <BookOpen className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="text-2xl font-bold tracking-tight text-stone-900 dark:text-zinc-50">
              {stats.studied_today}
            </div>
            <p className="text-[11px] text-stone-400 dark:text-zinc-400">Tarjetas contestadas</p>
          </Card>

          <Card className="border border-stone-200 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-900 shadow-xs p-5 space-y-2">
            <div className="flex items-center justify-between text-stone-400 dark:text-zinc-500">
              <span className="text-[11px] uppercase tracking-wider font-semibold">Retención</span>
              <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="text-2xl font-bold tracking-tight text-stone-900 dark:text-zinc-50">
              {stats.retention_rate}%
            </div>
            <p className="text-[11px] text-stone-400 dark:text-zinc-400">Porcentaje de aciertos hoy</p>
          </Card>

          <Card className="border border-stone-200 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-900 shadow-xs p-5 space-y-2">
            <div className="flex items-center justify-between text-stone-400 dark:text-zinc-500">
              <span className="text-[11px] uppercase tracking-wider font-semibold">Nuevas vistas</span>
              <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="text-2xl font-bold tracking-tight text-stone-900 dark:text-zinc-50">
              {stats.new_seen}
            </div>
            <p className="text-[11px] text-stone-400 dark:text-zinc-400">Tarjetas nuevas aprendidas</p>
          </Card>
        </div>
      )}

      {/* Info Card on FSRS with high contrast, legible typography and polished surfaces */}
      <div className="border border-stone-200 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-900 shadow-xs p-5 sm:p-6 space-y-3">
        <div className="flex items-center gap-3 text-stone-900 dark:text-zinc-50">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 shrink-0">
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <h3 className="text-sm sm:text-base font-semibold tracking-tight">
            Algoritmo de repetición FSRS en funcionamiento
          </h3>
        </div>
        <p className="text-xs sm:text-sm text-stone-600 dark:text-zinc-300 leading-relaxed pl-10">
          Tu progreso se calcula mediante el algoritmo{' '}
          <strong className="font-semibold text-stone-900 dark:text-zinc-100">
            FSRS (Free Spaced Repetition Scheduler)
          </strong>{' '}
          integrado en el motor de repetición del sistema. A diferencia de algoritmos antiguos (como SM-2), FSRS predice con alta precisión el olvido de cada tarjeta y ajusta los intervalos individualmente según la dificultad intrínseca y la estabilidad de la memoria.
        </p>
      </div>
    </div>
  );
}
