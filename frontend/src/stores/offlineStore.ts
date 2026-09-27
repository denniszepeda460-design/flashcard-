import { create } from 'zustand';

interface OfflineState {
  isOnline: boolean; // Internet connectivity
  isServerConnected: boolean; // Backend API connectivity
  pendingReviewCount: number;
  lastSync: string | null;
  setOnline: (status: boolean) => void;
  setServerConnected: (status: boolean) => void;
  incrementPending: () => void;
  setLastSync: (date: string) => void;
}

export const useOfflineStore = create<OfflineState>((set) => ({
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  isServerConnected: true,
  pendingReviewCount: 0,
  lastSync: null,
  setOnline: (status) => set({ isOnline: status }),
  setServerConnected: (status) => set({ isServerConnected: status }),
  incrementPending: () => set((state) => ({ pendingReviewCount: state.pendingReviewCount + 1 })),
  setLastSync: (date) => set({ lastSync: date }),
}));
