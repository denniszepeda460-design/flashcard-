import { get, post } from './client';
import { ReviewQueueResponse, AnswerResponse } from './types';

export function fetchReviewQueue(deckId: number, limit: number = 20) {
  return get<ReviewQueueResponse>(`/api/review/queue?deck_id=${deckId}&limit=${limit}`);
}

export function answerCard(cardId: number, rating: number) {
  return post<AnswerResponse>('/api/review/answer', { card_id: cardId, rating });
}

export function undoAnswer() {
  return post<{ success: boolean; message: string }>('/api/review/undo');
}
