import { get } from './client';
import { NoteTypeInfo } from './types';

export function fetchNoteTypes() {
  return get<NoteTypeInfo[]>('/api/notetypes');
}
