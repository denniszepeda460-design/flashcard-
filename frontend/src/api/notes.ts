import { get, post, patch, del } from './client';
import { NoteInfo, NoteCreate, NoteUpdate, NoteSearchResult } from './types';

export function createNote(data: NoteCreate) {
  return post<{ id: number; message: string }>('/api/notes', data);
}

export function getNote(id: number) {
  return get<NoteInfo>(`/api/notes/${id}`);
}

export function updateNote(id: number, data: NoteUpdate) {
  return patch<{ status: string; message: string }>(`/api/notes/${id}`, data);
}

export function deleteNote(id: number) {
  return del<{ status: string; message: string }>(`/api/notes/${id}`);
}

export function searchNotes(query: string = '', deckId?: number, limit: number = 50, offset: number = 0) {
  const params = new URLSearchParams({ q: query, limit: String(limit), offset: String(offset) });
  if (deckId !== undefined) params.append('deck_id', String(deckId));
  return get<NoteSearchResult>(`/api/notes/search?${params.toString()}`);
}
