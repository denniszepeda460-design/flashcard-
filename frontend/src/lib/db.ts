import { openDB as idbOpenDB, DBSchema, IDBPDatabase } from 'idb';
import { DeckInfo, CardForReview } from '../api/types';
import { answerCard } from '../api/review';

export interface PendingReview {
  id?: number;
  cardId: number;
  rating: number;
  timestamp: number;
}

export interface TodaySessionData {
  date: string;
  timestamp: number;
  timeStr: string;
  cards: CardForReview[];
  media: string[];
}

export interface CachedMediaItem {
  filename: string;
  blob: Blob;
  mimeType: string;
  cachedAt: number;
}

interface FlashcardDB extends DBSchema {
  decks: {
    key: number;
    value: DeckInfo;
  };
  cards: {
    key: number;
    value: CardForReview;
    indexes: { 'by-deck': number };
  };
  pendingReviews: {
    key: number;
    value: PendingReview;
  };
  syncMeta: {
    key: string;
    value: any;
  };
  todaySession: {
    key: string;
    value: TodaySessionData;
  };
  mediaCache: {
    key: string;
    value: CachedMediaItem;
  };
}

let dbPromise: Promise<IDBPDatabase<FlashcardDB>> | null = null;

export function openDB() {
  if (!dbPromise) {
    dbPromise = idbOpenDB<FlashcardDB>('flashcard-offline', 4, {
      upgrade(db, oldVersion) {
        if (oldVersion < 2) {
          if (db.objectStoreNames.contains('decks')) db.deleteObjectStore('decks');
          if (db.objectStoreNames.contains('cards')) db.deleteObjectStore('cards');
          if (db.objectStoreNames.contains('pendingReviews')) db.deleteObjectStore('pendingReviews');
          if (db.objectStoreNames.contains('syncMeta')) db.deleteObjectStore('syncMeta');
        }
        if (oldVersion < 3) {
          // Schema v3: pendingReviews usa autoIncrement id para preservar todas las respuestas secuencialmente
          if (db.objectStoreNames.contains('pendingReviews')) {
            db.deleteObjectStore('pendingReviews');
          }
          db.createObjectStore('pendingReviews', { keyPath: 'id', autoIncrement: true });
        }
        if (oldVersion < 4) {
          if (!db.objectStoreNames.contains('todaySession')) {
            db.createObjectStore('todaySession');
          }
          if (!db.objectStoreNames.contains('mediaCache')) {
            db.createObjectStore('mediaCache', { keyPath: 'filename' });
          }
        }
        if (!db.objectStoreNames.contains('decks')) {
          db.createObjectStore('decks', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('cards')) {
          const cardStore = db.createObjectStore('cards', { keyPath: 'card_id' });
          cardStore.createIndex('by-deck', 'deck_id');
        }
        if (!db.objectStoreNames.contains('pendingReviews')) {
          db.createObjectStore('pendingReviews', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('syncMeta')) {
          db.createObjectStore('syncMeta');
        }
        if (!db.objectStoreNames.contains('todaySession')) {
          db.createObjectStore('todaySession');
        }
        if (!db.objectStoreNames.contains('mediaCache')) {
          db.createObjectStore('mediaCache', { keyPath: 'filename' });
        }
      },
    });
  }
  return dbPromise;
}

export async function cacheDecks(decks: DeckInfo[]) {
  const db = await openDB();
  const tx = db.transaction('decks', 'readwrite');
  await tx.store.clear();
  for (const deck of decks) {
    await tx.store.put(deck);
  }
  await tx.done;
}

export async function getCachedDecks(): Promise<DeckInfo[]> {
  const db = await openDB();
  return db.getAll('decks');
}

export async function cacheCards(deckId: number, cards: CardForReview[]) {
  const db = await openDB();
  const tx = db.transaction('cards', 'readwrite');
  let cursor = await tx.store.index('by-deck').openCursor(IDBKeyRange.only(deckId));
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  for (const card of cards) {
    await tx.store.put(card);
  }
  await tx.done;
}

export async function getCachedCards(deckId: number): Promise<CardForReview[]> {
  const db = await openDB();
  return db.getAllFromIndex('cards', 'by-deck', deckId);
}

export async function enqueuePendingReview(review: Omit<PendingReview, 'id'>) {
  const db = await openDB();
  await db.add('pendingReviews', review as PendingReview);
}

export async function getPendingReviews(): Promise<PendingReview[]> {
  const db = await openDB();
  return db.getAll('pendingReviews');
}

export async function deletePendingReview(id: number) {
  const db = await openDB();
  await db.delete('pendingReviews', id);
}

export async function clearPendingReviews() {
  const db = await openDB();
  await db.clear('pendingReviews');
}

/**
 * Drena la cola de pendientes hacia /api/review/answer en orden FIFO estricto.
 * Cada elemento se elimina de IndexedDB sólo si el servidor confirma éxito (200 OK).
 * Si se pierde la conexión a mitad del proceso, se detiene inmediatamente sin perder ni duplicar.
 */
export async function drainPendingReviews(): Promise<{ synced: number; remaining: number }> {
  const pending = await getPendingReviews();
  if (pending.length === 0) return { synced: 0, remaining: 0 };

  let synced = 0;
  for (const rev of pending) {
    try {
      await answerCard(rev.cardId, rev.rating);
      if (rev.id !== undefined) {
        await deletePendingReview(rev.id);
      }
      synced++;
    } catch (err) {
      console.warn(`[Sync] Error sincronizando repaso para tarjeta ${rev.cardId}. Deteniendo drenado para preservar pendientes:`, err);
      break;
    }
  }

  const remainingList = await getPendingReviews();
  return { synced, remaining: remainingList.length };
}

export async function setSyncMeta(meta: any) {
  const db = await openDB();
  await db.put('syncMeta', meta, 'meta');
}

export async function getSyncMeta() {
  const db = await openDB();
  return db.get('syncMeta', 'meta');
}

// Helpers para todaySession
export async function saveTodaySession(data: TodaySessionData): Promise<void> {
  const db = await openDB();
  // Guardar tanto por clave de fecha como por clave 'latest' para fácil acceso
  await db.put('todaySession', data, data.date);
  await db.put('todaySession', data, 'latest');
}

export async function getTodaySessionFromDB(dateKey: string): Promise<TodaySessionData | undefined> {
  const db = await openDB();
  return db.get('todaySession', dateKey);
}

export async function clearTodaySessionDB(): Promise<void> {
  const db = await openDB();
  await db.clear('todaySession');
}

// Helpers para mediaCache
export async function saveCachedMedia(filename: string, blob: Blob): Promise<void> {
  const db = await openDB();
  await db.put('mediaCache', {
    filename,
    blob,
    mimeType: blob.type || 'application/octet-stream',
    cachedAt: Date.now(),
  });
}

export async function getCachedMedia(filename: string): Promise<CachedMediaItem | undefined> {
  const db = await openDB();
  return db.get('mediaCache', filename);
}

export async function clearMediaCacheDB(): Promise<void> {
  const db = await openDB();
  await db.clear('mediaCache');
}
