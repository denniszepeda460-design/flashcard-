import { create } from 'zustand';
import { DeckInfo, TodayStats } from '../api/types';
import { fetchDecks, createDeck as apiCreateDeck } from '../api/decks';
import { fetchTodayStats } from '../api/stats';
import { cacheDecks, getCachedDecks, cacheTodayStats, getCachedTodayStats } from '../lib/db';
import { getPendingReviewCountsByDeck, adjustDecksWithPending } from '../lib/deckUtils';

interface DeckState {
  decks: DeckInfo[];
  stats: TodayStats | null;
  isLoadingDecks: boolean;
  isLoadingStats: boolean;
  isInitialized: boolean;
  error: string | null;

  loadDecksAndStats: () => Promise<void>;
  createDeck: (name: string) => Promise<{ id: number; name: string }>;
  refreshPendingAdjustments: () => Promise<void>;
}

export const useDeckStore = create<DeckState>((set, get) => ({
  decks: [],
  stats: null,
  isLoadingDecks: true,
  isLoadingStats: true,
  isInitialized: false,
  error: null,

  loadDecksAndStats: async () => {
    // 1. LECTURA INMEDIATA DE CACHÉ (IndexedDB): se ejecuta en milisegundos
    // Garantiza que la pantalla nunca empiece en blanco ni parpadee "No hay mazos"
    try {
      const [cachedDecks, cachedStats, pendingCounts] = await Promise.all([
        getCachedDecks().catch(() => []),
        getCachedTodayStats().catch(() => null),
        getPendingReviewCountsByDeck().catch(() => ({})),
      ]);

      const adjustedCached = adjustDecksWithPending(cachedDecks, pendingCounts);

      // Si hay datos en caché o en memoria, mostrarlos de inmediato
      set((state) => ({
        decks: state.decks.length > 0 ? state.decks : adjustedCached,
        stats: state.stats !== null ? state.stats : cachedStats,
        isLoadingDecks: state.decks.length === 0 && adjustedCached.length === 0,
        isLoadingStats: state.stats === null && cachedStats === null,
        isInitialized: state.decks.length > 0 || adjustedCached.length > 0,
      }));
    } catch (e) {
      console.warn('[DeckStore] Error leyendo caché inicial:', e);
    }

    // 2. PETICIONES DE RED EN PARALELO (Promise.allSettled)
    // El peor tiempo de espera será max(6s, 6s) = 6s, nunca 12s secuenciales.
    const [decksResult, statsResult] = await Promise.allSettled([
      fetchDecks(),
      fetchTodayStats(),
    ]);

    // --- Procesar resultado de Mazos ---
    if (decksResult.status === 'fulfilled') {
      const freshDecks = decksResult.value;
      if (Array.isArray(freshDecks)) {
        await cacheDecks(freshDecks);

        // Descontar del conteo visible las revisiones que estén pendientes localmente
        const pendingCounts = await getPendingReviewCountsByDeck();
        const adjustedFresh = adjustDecksWithPending(freshDecks, pendingCounts);

        set({
          decks: adjustedFresh,
          isLoadingDecks: false,
          isInitialized: true,
          error: null,
        });
      }
    } else {
      // SI LA RED FALLA: Conservar estrictamente lo que ya está en memoria o en caché.
      // NUNCA vaciar la lista por error de red.
      console.warn('[DeckStore] Servidor inaccesible para mazos, conservando datos locales:', decksResult.reason);
      set((state) => ({
        isLoadingDecks: false,
        isInitialized: true,
      }));
    }

    // --- Procesar resultado de Estadísticas ---
    if (statsResult.status === 'fulfilled') {
      const freshStats = statsResult.value;
      if (freshStats) {
        await cacheTodayStats(freshStats);
        set({
          stats: freshStats,
          isLoadingStats: false,
        });
      }
    } else {
      // SI LA RED FALLA: Conservar las últimas estadísticas guardadas en caché
      console.warn('[DeckStore] Servidor inaccesible para estadísticas, conservando caché local:', statsResult.reason);
      set({
        isLoadingStats: false,
      });
    }
  },

  createDeck: async (name: string) => {
    const newDeck = await apiCreateDeck(name);
    // Recargar datos para actualizar la colección
    await get().loadDecksAndStats();
    return newDeck;
  },

  refreshPendingAdjustments: async () => {
    try {
      const [cachedDecks, pendingCounts] = await Promise.all([
        getCachedDecks().catch(() => []),
        getPendingReviewCountsByDeck().catch(() => ({})),
      ]);
      const baseDecks = get().decks.length > 0 ? get().decks : cachedDecks;
      const adjusted = adjustDecksWithPending(baseDecks, pendingCounts);
      set({ decks: adjusted });
    } catch (err) {
      console.warn('[DeckStore] Error recalculando ajustes de pendientes:', err);
    }
  },
}));
