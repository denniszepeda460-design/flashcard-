import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Flame, Calendar as CalendarIcon, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';

interface Props {
  streakDays: number;
  studiedToday: number;
}

export function StudyCalendar({ streakDays, studiedToday }: Props) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday
  // Convert so Monday is 0: (day + 6) % 7
  const startDay = (firstDayIndex + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
  const currentDay = today.getDate();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Generate mock studied days based on streak for past days of current month
  const isDayStudied = (day: number) => {
    if (!isCurrentMonth) return false;
    if (day === currentDay) return studiedToday > 0;
    if (day < currentDay && currentDay - day <= streakDays) return true;
    return false;
  };

  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const emptyDays = Array.from({ length: startDay }, (_, i) => i);

  return (
    <Card className="border border-stone-200 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
      <CardHeader className="pb-3 border-b border-stone-200/80 dark:border-zinc-800 bg-stone-50/60 dark:bg-zinc-950/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200/60 dark:border-blue-900/40">
              <CalendarIcon className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold tracking-tight text-stone-900 dark:text-zinc-100">
                Calendario de Estudio
              </CardTitle>
              <p className="text-[11px] text-stone-500 dark:text-zinc-400">
                Constancia y racha de repasos
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handlePrevMonth}
              className="p-1 rounded-md hover:bg-stone-100 dark:hover:bg-zinc-800 text-stone-500 dark:text-zinc-400 transition-colors pressable"
              title="Mes anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs font-medium text-stone-800 dark:text-zinc-200 min-w-[90px] text-center">
              {monthNames[month]} {year}
            </span>
            <button
              onClick={handleNextMonth}
              className="p-1 rounded-md hover:bg-stone-100 dark:hover:bg-zinc-800 text-stone-500 dark:text-zinc-400 transition-colors pressable"
              title="Mes siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-3.5 pb-4 space-y-3.5">
        {/* Streak summary pill */}
        <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-stone-50 dark:bg-zinc-800/60 border border-stone-200/80 dark:border-zinc-800 text-xs">
          <div className="flex items-center gap-1.5 font-medium text-stone-800 dark:text-zinc-200">
            <Flame className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
            <span>Racha activa: <strong className="font-semibold">{streakDays} {streakDays === 1 ? 'día' : 'días'}</strong></span>
          </div>
          <span className="text-[11px] text-stone-500 dark:text-zinc-400">
            {studiedToday > 0 ? 'Meta de hoy completada' : 'Pendiente hoy'}
          </span>
        </div>

        {/* Days of week header */}
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-stone-400 dark:text-zinc-500 uppercase">
          <span>Lun</span>
          <span>Mar</span>
          <span>Mié</span>
          <span>Jue</span>
          <span>Vie</span>
          <span>Sáb</span>
          <span>Dom</span>
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 gap-1">
          {emptyDays.map((i) => (
            <div key={`empty-${i}`} className="h-8 w-full" />
          ))}

          {daysArray.map((day) => {
            const isToday = isCurrentMonth && day === currentDay;
            const studied = isDayStudied(day);

            let dayStyle = 'text-stone-600 dark:text-zinc-400 hover:bg-stone-100 dark:hover:bg-zinc-800';

            if (studied) {
              dayStyle = 'bg-blue-600 text-white font-medium shadow-2xs';
            } else if (isToday) {
              dayStyle = 'border border-blue-600 text-blue-600 dark:text-blue-400 font-semibold';
            }

            return (
              <div
                key={day}
                className={`h-8 w-full rounded-lg flex flex-col items-center justify-center text-xs transition-colors relative ${dayStyle}`}
                title={studied ? `Día ${day}: Estudiado` : `Día ${day}`}
              >
                <span>{day}</span>
                {studied && (
                  <span className="w-1 h-1 rounded-full bg-white/80 absolute bottom-0.5" />
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
