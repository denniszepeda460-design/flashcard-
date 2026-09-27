import { useEffect, useState, useCallback } from 'react';
import { useOfflineStore } from '../stores/offlineStore';
import { get } from '../api/client';

export function useOffline() {
  const { isOnline, isServerConnected, setOnline, setServerConnected } = useOfflineStore();
  const [isChecking, setIsChecking] = useState(false);

  const checkHealth = useCallback(async () => {
    setIsChecking(true);
    try {
      await get<{ status: string }>('/api/health');
      setServerConnected(true);
      setOnline(true);
    } catch (e) {
      setServerConnected(false);
      // Only set offline if browser truly reports no internet
      if (!navigator.onLine) {
        setOnline(false);
      }
    } finally {
      setIsChecking(false);
    }
  }, [setOnline, setServerConnected]);

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      checkHealth();
    };
    const handleOffline = () => {
      setOnline(false);
      setServerConnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check immediately
    checkHealth();

    const interval = setInterval(checkHealth, 15000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [setOnline, setServerConnected, checkHealth]);

  return { isOnline, isServerConnected, isChecking, checkHealth };
}
