import { get } from './client';
import { TodayStats } from './types';

export function fetchTodayStats() {
  return get<TodayStats>('/api/stats/today');
}
