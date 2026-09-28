import { useState, useEffect, useCallback, useRef } from 'react';
import { triggerSync, getSyncStatus } from '../api/sync';
import { fetchDecks } from '../api/decks';
import { answerCard } from '../api/review';
import {
  getPendingReviews,
  drainPendingReviews,
  cacheDecks,
  setSyncMeta,
  getSyncMeta,
} from '../lib/db';
import { useOfflineStore } from '../stores/offlineStore';
import { clearBackendUnreachable } from '../api/client';
import { useDeckStore } from '../stores/deckStore';

export type SyncState = 'idle' | 'syncing' | 'success' | 'error';

export function useSync() {
  const { isOnline } = useOfflineStore();
  const [status, setStatus] = useState<SyncState>('idle');
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState<number>(0);

  const isSyncingRef = useRef(false);

  // Load last sync metadata on mount
  useEffect(() => {
    getSyncMeta().then((meta) => {
      if (meta?.lastSync) {
        setLastSyncTime(meta.lastSync);
      }
    });
    getPendingReviews().then((p) => setPendingCount(p.length));
  }, []);

  const performSync = useCallback(async () => {
    if (isSyncingRef.current || !navigator.onLine) return;
    // Limpiar el cooldown de conexión para permitir un intento real
    clearBackendUnreachable();

    isSyncingRef.current = true;
    setStatus('syncing');
    setErrorMessage(null);

    try {
      // Step 1: Upload pending reviews atomically if any
      const { synced, remaining } = await drainPendingReviews();
      setPendingCount(remaining);
      if (synced > 0) {
        console.log(`[Sync] Se sincronizaron exitosamente ${synced} repasos pendientes (${remaining} restantes).`);
      }

      // Step 2: Trigger backend sync server coordination
      await triggerSync();

      // Step 3: Refresh local cached decks and data
      const freshDecks = await fetchDecks();
      await cacheDecks(freshDecks);

      // Actualizar el store global de mazos y estadísticas
      await useDeckStore.getState().loadDecksAndStats();

      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setLastSyncTime(nowStr);
      await setSyncMeta({ lastSync: nowStr });

      setStatus('success');
      setTimeout(() => setStatus('idle'), 4000);
    } catch (err: any) {
      console.error('Error durante sincronización:', err);
      setStatus('error');
      setErrorMessage(err.message || 'Error de sincronización');
      // Auto-restaurar estado a 'idle' tras 4 segundos para no dejar el botón en rojo permanentemente
      setTimeout(() => setStatus('idle'), 4000);
    } finally {
      isSyncingRef.current = false;
    }
  }, []);

  // Periodic automatic sync every 10 minutes (600,000 ms)
  useEffect(() => {
    const interval = setInterval(() => {
      if (navigator.onLine) {
        console.log('Ejecutando sincronización automática (cada 10 min)...');
        performSync();
      }
    }, 10 * 60 * 1000);

    return () => clearInterval(interval);
  }, [performSync]);

  // When coming back online, flush pending reviews and sync immediately
  useEffect(() => {
    const handleBackOnline = () => {
      console.log('Dispositivo reconectado a la red, iniciando sincronización...');
      performSync();
    };

    window.addEventListener('online', handleBackOnline);
    return () => window.removeEventListener('online', handleBackOnline);
  }, [performSync]);

  return {
    status,
    lastSyncTime,
    errorMessage,
    pendingCount,
    performSync,
  };
}
