import React from 'react';
import { Moon, Sun, WifiOff, RefreshCw, Settings, ServerOff } from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore';
import { useOffline } from '../../hooks/useOffline';
import { useSync } from '../../hooks/useSync';
import { Link } from 'react-router-dom';

export function Navbar() {
  const { theme, setTheme } = useSettingsStore();
  const { isOnline, isServerConnected } = useOffline();
  const { status, lastSyncTime, performSync, pendingCount } = useSync();

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-stone-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md">
      <div className="flex h-15 items-center justify-between px-4 sm:px-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 group">
            <span className="text-xl font-bold tracking-tight text-stone-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              Flashcards
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Offline Indicator */}
          {!isOnline && (
            <div className="flex items-center gap-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900/60 px-2.5 py-1 text-xs font-medium text-amber-800 dark:text-amber-200">
              <WifiOff className="h-3.5 w-3.5 shrink-0" />
              <span>Offline</span>
              {pendingCount > 0 && (
                <span className="text-[10px] font-mono opacity-80">({pendingCount})</span>
              )}
            </div>
          )}

          {isOnline && !isServerConnected && (
            <div className="flex items-center gap-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900/60 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">
              <ServerOff className="h-3.5 w-3.5 shrink-0" />
              <span>Conectando...</span>
            </div>
          )}

          {/* Sync Button */}
          <button
            onClick={() => performSync()}
            disabled={status === 'syncing' || !isServerConnected}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all duration-150 active:scale-95 ${
              status === 'syncing'
                ? 'border-blue-400 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300'
                : status === 'error'
                ? 'border-red-200 dark:border-red-900/60 bg-red-50/70 dark:bg-red-950/30 text-red-600 dark:text-red-400'
                : 'border-stone-200 dark:border-zinc-800 hover:bg-stone-100 dark:hover:bg-zinc-800 text-stone-600 dark:text-zinc-300'
            }`}
            title={lastSyncTime ? `Sincronizado: ${lastSyncTime}` : 'Sincronizar'}
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${status === 'syncing' ? 'animate-spin' : ''}`}
            />
            <span className="hidden sm:inline">
              {status === 'syncing'
                ? 'Sincronizando...'
                : status === 'error'
                ? 'Error'
                : 'Sincronizar'}
            </span>
          </button>

          {/* Dark Mode Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl text-stone-500 hover:text-stone-800 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Cambiar tema"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          {/* Settings Link */}
          <Link
            to="/settings"
            className="p-2 rounded-xl text-stone-500 hover:text-stone-800 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors"
            title="Ajustes"
          >
            <Settings className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </header>
  );
}
