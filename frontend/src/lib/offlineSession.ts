import { CardForReview } from '../api/types';
import { fetchFullReviewSession } from '../api/review';
import { getBaseUrl, getApiKey } from '../api/client';
import {
  TodaySessionData,
  saveTodaySession,
  getTodaySessionFromDB,
  clearTodaySessionDB,
  saveCachedMedia,
  getCachedMedia,
  clearMediaCacheDB,
} from './db';

export function getTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getCurrentTimeString(): string {
  const d = new Date();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Revisa si ya existe una sesión descargada para la fecha de hoy con tarjetas pendientes.
 */
export async function hasValidSessionForToday(): Promise<boolean> {
  try {
    const today = getTodayDateString();
    const session = await getTodaySessionFromDB(today);
    return !!session && Array.isArray(session.cards) && session.cards.length > 0;
  } catch (err) {
    console.warn('[OfflineSession] Error comprobando todaySession:', err);
    return false;
  }
}

/**
 * Obtiene la sesión de hoy, opcionalmente filtrada por mazo.
 */
export async function getTodaySession(deckId?: number): Promise<TodaySessionData | null> {
  try {
    const today = getTodayDateString();
    let session = await getTodaySessionFromDB(today);
    if (!session) {
      // Fallback a la última sesión guardada
      session = await getTodaySessionFromDB('latest');
    }
    if (!session || !session.cards) return null;

    if (deckId !== undefined) {
      const filteredCards = session.cards.filter((c) => c.deck_id === deckId);
      return {
        ...session,
        cards: filteredCards,
      };
    }
    return session;
  } catch (err) {
    console.warn('[OfflineSession] Error obteniendo todaySession:', err);
    return null;
  }
}

/**
 * Borra todaySession y mediaCache (se llama tras completar con éxito el drenado de sync).
 */
export async function clearSession(): Promise<void> {
  try {
    await clearTodaySessionDB();
    await clearMediaCacheDB();
    console.log('[OfflineSession] todaySession y mediaCache limpiados con éxito.');
  } catch (err) {
    console.warn('[OfflineSession] Error limpiando sesión offline:', err);
  }
}

/**
 * Descarga la sesión completa de repaso para todo el día y cachea todos los recursos multimedia.
 */
export async function downloadTodaySession(deckId?: number): Promise<boolean> {
  try {
    console.log('[OfflineSession] Iniciando descarga de sesión completa para hoy...');
    const fullSession = await fetchFullReviewSession(deckId);
    if (!fullSession || !Array.isArray(fullSession.cards)) {
      console.warn('[OfflineSession] Respuesta de sesión vacía o inválida.');
      return false;
    }

    const todayDate = fullSession.date || getTodayDateString();
    const timeStr = getCurrentTimeString();

    const sessionData: TodaySessionData = {
      date: todayDate,
      timestamp: Date.now(),
      timeStr,
      cards: fullSession.cards,
      media: fullSession.media || [],
    };

    await saveTodaySession(sessionData);
    console.log(`[OfflineSession] Guardadas ${fullSession.cards.length} tarjetas en todaySession (${todayDate} a las ${timeStr}).`);

    // Descarga de archivos multimedia en caché
    if (fullSession.media && fullSession.media.length > 0) {
      const baseUrl = getBaseUrl();
      const apiKey = getApiKey();
      console.log(`[OfflineSession] Descargando ${fullSession.media.length} archivos multimedia...`);

      const mediaList = fullSession.media;
      const downloadTasks = mediaList.map(async (filename) => {
        try {
          const cached = await getCachedMedia(filename);
          if (cached) return; // Ya en caché local

          const mediaUrl = `${baseUrl}/api/media/${encodeURIComponent(filename)}`;
          const res = await fetch(mediaUrl, {
            headers: apiKey ? { 'X-API-Key': apiKey } : {},
            signal: AbortSignal.timeout(10000),
          });
          if (res.ok) {
            const blob = await res.blob();
            await saveCachedMedia(filename, blob);
          } else {
            console.warn(`[OfflineSession] No se pudo descargar media '${filename}': HTTP ${res.status}`);
          }
        } catch (err) {
          console.warn(`[OfflineSession] Error descargando media '${filename}':`, err);
        }
      });

      await Promise.allSettled(downloadTasks);
      console.log('[OfflineSession] Descarga de multimedia finalizada.');
    }

    return true;
  } catch (err) {
    console.warn('[OfflineSession] Error en downloadTodaySession:', err);
    return false;
  }
}

/**
 * Reemplaza las URLs de media en el HTML y campos por Blob URLs locales de IndexedDB
 * para permitir visualización y reproducción de audio 100% offline.
 */
export async function prepareOfflineCards(cards: CardForReview[]): Promise<CardForReview[]> {
  const prepared: CardForReview[] = [];

  for (const card of cards) {
    let qHtml = card.question_html || '';
    let aHtml = card.answer_html || '';
    const fieldsCopy = { ...card.fields };

    // Extraer nombres de media referenciados
    const mediaNames = new Set<string>();

    const findNames = (text: string) => {
      if (!text) return;
      // [sound:filename]
      for (const m of text.matchAll(/\[sound:([^\]]+)\]/g)) {
        const clean = m[1].trim().split('/').pop()?.split('?')[0];
        if (clean) mediaNames.add(clean);
      }
      // src="..." o src='...'
      for (const m of text.matchAll(/src=['"]([^'"]+)['"]/g)) {
        const clean = m[1].trim().split('/').pop()?.split('?')[0];
        if (clean && !clean.startsWith('http') && !clean.startsWith('data:')) {
          mediaNames.add(clean);
        }
      }
    };

    findNames(qHtml);
    findNames(aHtml);
    Object.values(fieldsCopy).forEach(findNames);

    // Reemplazar cada media encontrado por su Blob URL local
    for (const filename of mediaNames) {
      try {
        const cached = await getCachedMedia(filename);
        if (cached && cached.blob) {
          const blobUrl = URL.createObjectURL(cached.blob);

          const replaceInText = (str: string): string => {
            if (!str) return str;
            // Reemplazar src="..."
            let updated = str.replace(
              new RegExp(`src=['"][^'"]*${filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`, 'g'),
              `src="${blobUrl}"`
            );
            // Reemplazar [sound:filename] por tag de audio nativo
            updated = updated.replace(
              new RegExp(`\\[sound:${filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]`, 'g'),
              `<audio src="${blobUrl}" controls class="inline-audio my-2"></audio>`
            );
            return updated;
          };

          qHtml = replaceInText(qHtml);
          aHtml = replaceInText(aHtml);
          for (const key of Object.keys(fieldsCopy)) {
            fieldsCopy[key] = replaceInText(fieldsCopy[key]);
          }
        }
      } catch (err) {
        console.warn(`[OfflineSession] Error asociando blob URL para ${filename}:`, err);
      }
    }

    prepared.push({
      ...card,
      question_html: qHtml,
      answer_html: aHtml,
      fields: fieldsCopy,
    });
  }

  return prepared;
}
