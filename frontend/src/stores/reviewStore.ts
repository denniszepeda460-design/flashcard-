import { create } from 'zustand';
import type { CardForReview } from '../api/types';
import { fetchReviewQueue, answerCard } from '../api/review';
import { cacheCards, getCachedCards, enqueuePendingReview, drainPendingReviews } from '../lib/db';

interface ReviewState {
  cards: CardForReview[];
  currentIndex: number;
  originalTotal: number;
  retriesQueued: number;
  isLoading: boolean;
  isOfflineMode: boolean;
  offlineReason: string | null;
  isSyncedBanner: boolean;
  deckId: number | null;
  sessionStats: { correct: number; incorrect: number; total: number };
  loadQueue: (deckId: number) => Promise<void>;
  answerCurrent: (rating: number) => Promise<void>;
  syncPendingReviews: () => Promise<void>;
  nextCard: () => void;
  reset: () => void;
}

export const useReviewStore = create<ReviewState>((set, get) => ({
  cards: [],
  currentIndex: 0,
  originalTotal: 0,
  retriesQueued: 0,
  isLoading: false,
  isOfflineMode: false,
  offlineReason: null,
  isSyncedBanner: false,
  deckId: null,
  sessionStats: { correct: 0, incorrect: 0, total: 0 },

  syncPendingReviews: async () => {
    try {
      const { synced } = await drainPendingReviews();
      if (synced > 0) {
        set({ isSyncedBanner: true });
        setTimeout(() => set({ isSyncedBanner: false }), 4000);
      }
    } catch (e) {
      console.warn('[ReviewStore] Error drenando pendientes al reconectar:', e);
    }
  },

  loadQueue: async (deckId: number) => {
    set({ isLoading: true, deckId, offlineReason: null });
    try {
      const res = await fetchReviewQueue(deckId);
      const queueCards = res.cards || [];
      // Cache cards for offline usage
      if (queueCards.length > 0) {
        cacheCards(deckId, queueCards).catch((err) =>
          console.warn('Could not cache cards in IndexedDB:', err)
        );
      }
      set({
        cards: queueCards,
        currentIndex: 0,
        originalTotal: queueCards.length,
        retriesQueued: 0,
        isOfflineMode: false,
        offlineReason: null,
        sessionStats: { correct: 0, incorrect: 0, total: queueCards.length },
      });
      // Try draining any existing pending reviews now that server is reachable
      get().syncPendingReviews();
    } catch (e: any) {
      console.warn('Network request failed, attempting to load from IndexedDB...', e);
      try {
        const cached = await getCachedCards(deckId);
        const cachedCards = cached || [];
        set({
          cards: cachedCards,
          currentIndex: 0,
          originalTotal: cachedCards.length,
          retriesQueued: 0,
          isOfflineMode: true,
          offlineReason: 'No se pudo conectar a tu servidor — estudiando con tu última descarga.',
          sessionStats: { correct: 0, incorrect: 0, total: cachedCards.length },
        });
      } catch (err) {
        console.error('Failed to load cached cards from IndexedDB:', err);
      }
    } finally {
      set({ isLoading: false });
    }
  },

  answerCurrent: async (rating: number) => {
    const { cards, currentIndex, sessionStats, isOfflineMode, originalTotal, retriesQueued } = get();
    const card = cards[currentIndex];
    if (!card) return;

    const isCorrect = rating > 1;

    // Si el usuario presiona "De nuevo" (rating 1), reencolar la tarjeta al final
    // de la sesión para que vuelva a aparecer hasta que el usuario la domine.
    const updatedCards = rating === 1 ? [...cards, card] : cards;

    let updatedRetries = retriesQueued;
    if (currentIndex < originalTotal) {
      if (rating === 1) {
        updatedRetries = retriesQueued + 1;
      }
    } else {
      if (rating > 1) {
        updatedRetries = Math.max(0, retriesQueued - 1);
      }
    }

    set({
      cards: updatedCards,
      retriesQueued: updatedRetries,
      sessionStats: {
        ...sessionStats,
        correct: sessionStats.correct + (isCorrect ? 1 : 0),
        incorrect: sessionStats.incorrect + (isCorrect ? 0 : 1),
      },
    });

    if (isOfflineMode) {
      await enqueuePendingReview({
        cardId: card.card_id,
        rating,
        timestamp: Date.now(),
      });
      return;
    }

    try {
      await answerCard(card.card_id, rating);
    } catch (e) {
      console.warn('Failed to submit answer to server, enqueuing offline review:', e);
      try {
        await enqueuePendingReview({
          cardId: card.card_id,
          rating,
          timestamp: Date.now(),
        });
      } catch (err) {
        console.error('Failed to enqueue offline review:', err);
      }
    }
  },

  nextCard: () => {
    set((state) => ({ currentIndex: state.currentIndex + 1 }));
  },

  reset: () => {
    set({
      cards: [],
      currentIndex: 0,
      originalTotal: 0,
      retriesQueued: 0,
      deckId: null,
      isOfflineMode: false,
      offlineReason: null,
      isSyncedBanner: false,
      sessionStats: { correct: 0, incorrect: 0, total: 0 },
    });
  },
}));

// Escucha el evento online del navegador para intentar drenar automáticamente los repasos pendientes
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    useReviewStore.getState().syncPendingReviews();
  });
}
