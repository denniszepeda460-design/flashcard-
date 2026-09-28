import { DeckInfo } from '../api/types';
import { getPendingReviews, openDB } from './db';
import { getTodaySession } from './offlineSession';

/**
 * Cuenta cuántas tarjetas se han calificado en offline (en pendingReviews) para cada mazo.
 */
export async function getPendingReviewCountsByDeck(): Promise<Record<number, number>> {
  try {
    const pending = await getPendingReviews();
    if (!pending || pending.length === 0) return {};

    const cardToDeckMap = new Map<number, number>();

    // 1. Obtener mapeo card_id -> deck_id desde todaySession si existe
    try {
      const session = await getTodaySession();
      if (session && Array.isArray(session.cards)) {
        for (const card of session.cards) {
          if (card.card_id && card.deck_id) {
            cardToDeckMap.set(card.card_id, card.deck_id);
          }
        }
      }
    } catch (e) {
      console.warn('[DeckUtils] Error leyendo todaySession para conteo de pendientes:', e);
    }

    // 2. Complementar con las tarjetas cacheadas en la tabla 'cards'
    try {
      const db = await openDB();
      const allCachedCards = await db.getAll('cards');
      if (Array.isArray(allCachedCards)) {
        for (const c of allCachedCards) {
          if (c.card_id && c.deck_id && !cardToDeckMap.has(c.card_id)) {
            cardToDeckMap.set(c.card_id, c.deck_id);
          }
        }
      }
    } catch (e) {
      console.warn('[DeckUtils] Error leyendo cards de IndexedDB:', e);
    }

    // 3. Contar tarjetas únicas pendientes por mazo
    const reviewedCardIds = new Set<number>();
    const countsByDeck: Record<number, number> = {};

    for (const p of pending) {
      if (reviewedCardIds.has(p.cardId)) continue; // No contar duplicados de reintentos
      reviewedCardIds.add(p.cardId);

      const deckId = cardToDeckMap.get(p.cardId);
      if (deckId !== undefined) {
        countsByDeck[deckId] = (countsByDeck[deckId] || 0) + 1;
      }
    }

    return countsByDeck;
  } catch (err) {
    console.warn('[DeckUtils] Error calculando pendientes por mazo:', err);
    return {};
  }
}

/**
 * Ajusta los contadores visibles de cada mazo restando las tarjetas
 * que ya fueron calificadas en la sesión offline actual.
 */
export function adjustDecksWithPending(
  decks: DeckInfo[],
  pendingCounts: Record<number, number>
): DeckInfo[] {
  if (!decks || decks.length === 0) return [];
  if (!pendingCounts || Object.keys(pendingCounts).length === 0) return decks;

  return decks.map((deck) => {
    const pendingForDeck = pendingCounts[deck.id] || 0;
    if (pendingForDeck <= 0) return deck;

    let remainingToDeduct = pendingForDeck;
    let reviewCount = deck.review_count || 0;
    let learnCount = deck.learn_count || 0;
    let newCount = deck.new_count || 0;

    // Descontar primero de repasos pendientes
    const deductedFromReview = Math.min(reviewCount, remainingToDeduct);
    reviewCount -= deductedFromReview;
    remainingToDeduct -= deductedFromReview;

    // Luego de tarjetas en aprendizaje si aún restan
    if (remainingToDeduct > 0) {
      const deductedFromLearn = Math.min(learnCount, remainingToDeduct);
      learnCount -= deductedFromLearn;
      remainingToDeduct -= deductedFromLearn;
    }

    // Luego de tarjetas nuevas si aún restan
    if (remainingToDeduct > 0) {
      const deductedFromNew = Math.min(newCount, remainingToDeduct);
      newCount -= deductedFromNew;
      remainingToDeduct -= deductedFromNew;
    }

    return {
      ...deck,
      review_count: reviewCount,
      learn_count: learnCount,
      new_count: newCount,
    };
  });
}
