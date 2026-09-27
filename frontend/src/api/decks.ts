import { get, post, patch, del } from './client';
import { DeckInfo, DeckListResponse } from './types';

export async function fetchDecks(): Promise<DeckInfo[]> {
  const res = await get<DeckListResponse>('/api/decks/');
  return (res.decks || []).filter((d) => d.id > 0 && d.name.trim().length > 0);
}

export function createDeck(name: string) {
  return post<{ id: number; name: string }>('/api/decks/', { name });
}

export function renameDeck(id: number, name: string) {
  return patch<{ status: string }>(`/api/decks/${id}`, { name });
}

export function deleteDeck(id: number) {
  return del<{ status: string }>(`/api/decks/${id}`);
}
