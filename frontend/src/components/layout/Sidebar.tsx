import React from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { Layers, PlusCircle, Search, BarChart3, Settings } from 'lucide-react';

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  isMobile?: boolean;
}

const navItems = [
  { to: '/', icon: Layers, label: 'Mazos' },
  { to: '/editor', icon: PlusCircle, label: 'Crear' },
  { to: '/browser', icon: Search, label: 'Explorar' },
  { to: '/stats', icon: BarChart3, label: 'Estadísticas' },
  { to: '/settings', icon: Settings, label: 'Ajustes' },
];

export function Sidebar({ className, isMobile, ...props }: SidebarProps) {
  if (isMobile) {
    return (
      <nav className={cn('bg-white dark:bg-zinc-900 border-t border-stone-200/80 dark:border-zinc-800/80', className)} {...props}>
        <div className="flex h-14 items-center justify-around px-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center p-2 text-[11px] font-medium transition-colors',
                  isActive
                    ? 'text-blue-600 dark:text-blue-400 font-semibold'
                    : 'text-stone-500 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-zinc-100'
                )
              }
            >
              <item.icon className="mb-0.5 h-4 w-4" strokeWidth={1.75} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    );
  }

  return (
    <aside className={cn('bg-white/60 dark:bg-zinc-900/60 border-r border-stone-200/80 dark:border-zinc-800/80', className)} {...props}>
      <nav className="flex flex-col gap-1 p-3">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all duration-150',
                isActive
                  ? 'bg-stone-100 dark:bg-zinc-800 text-blue-600 dark:text-blue-400'
                  : 'text-stone-600 dark:text-zinc-400 hover:bg-stone-50 dark:hover:bg-zinc-800/60 hover:text-stone-900 dark:hover:text-zinc-100'
              )
            }
          >
            <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
