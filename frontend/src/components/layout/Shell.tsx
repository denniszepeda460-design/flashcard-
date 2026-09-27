import React from 'react';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[#FAFAF9] dark:bg-[#121214] text-stone-900 dark:text-zinc-100 transition-colors">
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar className="hidden w-60 border-r border-stone-200/80 dark:border-zinc-800/80 md:block shrink-0 bg-white/70 dark:bg-zinc-900/60 backdrop-blur-sm" />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-5xl">
            {children}
          </div>
        </main>
      </div>
      <Sidebar className="block border-t border-stone-200/80 dark:border-zinc-800/80 md:hidden bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md" isMobile />
    </div>
  );
}
