export interface DeckInfo {
  id: number;
  name: string;
  card_count: number;
  new_count: number;
  learn_count: number;
  review_count: number;
}

export interface DeckListResponse {
  decks: DeckInfo[];
}

export interface NoteInfo {
  id: number;
  deck_id: number;
  note_type_name: string;
  fields: Record<string, string>;
  tags: string[];
}

export interface NoteCreate {
  deck_id: number;
  note_type_name: string;
  fields: Record<string, string>;
  tags?: string[];
}

export interface NoteUpdate {
  fields?: Record<string, string>;
  tags?: string[];
}

export interface CardForReview {
  card_id: number;
  note_id: number;
  deck_id: number;
  note_type_name: string;
  fields: Record<string, string>;
  template_idx: number;
  scheduling_states?: Record<string, string>;
}

export interface ReviewQueueResponse {
  cards: CardForReview[];
  remaining: number;
}

export interface AnswerRequest {
  card_id: number;
  rating: number; // 1: Again, 2: Hard, 3: Good, 4: Easy
}

export interface AnswerResponse {
  success: boolean;
  next_card?: CardForReview | null;
}

export interface NoteTypeInfo {
  id: number;
  name: string;
  fields: string[];
  type?: 'standard' | 'cloze';
}

export interface TodayStats {
  studied_today: number;
  streak_days: number;
  retention_rate: number;
  new_seen: number;
  reviews_done: number;
}

export interface SyncStatus {
  last_sync: string | null;
  status: 'idle' | 'syncing' | 'error';
  message?: string | null;
}

export interface SyncTriggerResponse {
  success: boolean;
  message: string;
}

export interface NoteSearchResult {
  notes: NoteInfo[];
  total: number;
}
