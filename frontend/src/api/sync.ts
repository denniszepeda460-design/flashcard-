import { get, post } from './client';
import { SyncStatus, SyncTriggerResponse } from './types';

export function triggerSync() {
  return post<SyncTriggerResponse>('/api/sync/trigger');
}

export function getSyncStatus() {
  return get<SyncStatus>('/api/sync/status');
}
