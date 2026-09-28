import { get, post } from './client';
import { ReviewQueueResponse, AnswerResponse, FullReviewSessionResponse } from './types';

export function fetchReviewQueue(deckId: number, limit: number = 20) {
  return get<ReviewQueueResponse>(`/api/review/queue?deck_id=${deckId}&limit=${limit}`);
}

export function fetchFullReviewSession(deckId?: number) {
  const query = deckId !== undefined ? `?deck_id=${deckId}` : '';
  // Timeout más holgado para sesiones completas con muchas tarjetas (15s)
  return get<FullReviewSessionResponse>(`/api/review/session/full${query}`, 15000);
}

export function answerCard(cardId: number, rating: number) {
  return post<AnswerResponse>('/api/review/answer', { card_id: cardId, rating });
}

export function undoAnswer() {
  return post<{ success: boolean; message: string }>('/api/review/undo');
}
