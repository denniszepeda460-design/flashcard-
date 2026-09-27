import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  theme: 'light' | 'dark' | 'system';
  apiKey: string;
  backendUrl: string;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setApiKey: (key: string) => void;
  setBackendUrl: (url: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'system',
      apiKey: 'mi-clave-secreta-123',
      backendUrl: '',
      setTheme: (theme) => set({ theme }),
      setApiKey: (apiKey) => set({ apiKey }),
      setBackendUrl: (backendUrl) => {
        let clean = (backendUrl || '').trim();
        if (clean.includes(':5173')) {
          clean = '';
        } else if (clean.includes(':8000')) {
          clean = clean.replace(':8000', ':8001');
        }
        set({ backendUrl: clean });
      },
    }),
    {
      name: 'settings-storage',
      onRehydrateStorage: () => (state) => {
        if (state && state.backendUrl && state.backendUrl.includes(':5173')) {
          state.backendUrl = '';
        }
      },
    }
  )
);
