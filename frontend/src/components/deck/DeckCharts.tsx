import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { PieChart as PieIcon, TrendingUp } from 'lucide-react';
import { DeckInfo } from '../../api/types';

interface Props {
  decks: DeckInfo[];
  studiedToday: number;
}

export function DeckCharts({ decks, studiedToday }: Props) {
  // Compute totals across decks
  const totalNew = decks.reduce((acc, d) => acc + (d.new_count || 0), 0);
  const totalLearn = decks.reduce((acc, d) => acc + (d.learn_count || 0), 0);
  const totalDue = decks.reduce((acc, d) => acc + (d.review_count || 0), 0);
  const totalCards = decks.reduce((acc, d) => acc + (d.card_count || 0), 0);
  const matureCards = Math.max(0, totalCards - totalNew - totalLearn - totalDue);

  const totalSegmented = totalNew + totalLearn + totalDue + matureCards || 1;

  // Donut chart segments calculation
  const segments = [
    { label: 'Nuevas', value: totalNew, color: '#2563eb', bgClass: 'bg-blue-600' },
    { label: 'Aprendiendo', value: totalLearn, color: '#d97706', bgClass: 'bg-amber-600' },
    { label: 'A repasar', value: totalDue, color: '#e11d48', bgClass: 'bg-rose-600' },
    { label: 'Maduras', value: matureCards, color: '#78716c', bgClass: 'bg-stone-500' },
  ];

  // SVG Donut calculation
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  let accumulatedOffset = 0;

  // Mock progress history for last 7 days (trend line)
  const historyData = [
    { day: 'Lun', count: Math.max(2, Math.round(studiedToday * 0.4)) },
    { day: 'Mar', count: Math.max(5, Math.round(studiedToday * 0.7)) },
    { day: 'Mié', count: Math.max(3, Math.round(studiedToday * 0.5)) },
    { day: 'Jue', count: Math.max(8, Math.round(studiedToday * 0.9)) },
    { day: 'Vie', count: Math.max(6, Math.round(studiedToday * 0.6)) },
    { day: 'Sáb', count: Math.max(4, Math.round(studiedToday * 0.5)) },
    { day: 'Hoy', count: studiedToday },
  ];

  const maxCount = Math.max(...historyData.map((d) => d.count), 10);
  const chartHeight = 120;
  const chartWidth = 280;
  const paddingX = 20;
  const stepX = (chartWidth - paddingX * 2) / (historyData.length - 1);

  const points = historyData.map((d, i) => {
    const x = paddingX + i * stepX;
    const y = chartHeight - (d.count / maxCount) * (chartHeight - 30) - 15;
    return { x, y, ...d };
  });

  const pathD = points.reduce((acc, p, i) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    // Smooth bezier curve
    const prev = points[i - 1];
    const cx1 = prev.x + (p.x - prev.x) / 2;
    const cy1 = prev.y;
    const cx2 = prev.x + (p.x - prev.x) / 2;
    const cy2 = p.y;
    return `${acc} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${p.x} ${p.y}`;
  }, '');

  const areaD = `${pathD} L ${points[points.length - 1].x} ${chartHeight} L ${points[0].x} ${chartHeight} Z`;

  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* 1. Pie / Donut Chart */}
      <Card className="border border-stone-200 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
        <CardHeader className="pb-2 border-b border-stone-200/80 dark:border-zinc-800 bg-stone-50/60 dark:bg-zinc-950/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200/60 dark:border-blue-900/40">
              <PieIcon className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold tracking-tight text-stone-900 dark:text-zinc-100">
                Distribución de Tarjetas
              </CardTitle>
              <p className="text-[11px] text-stone-500 dark:text-zinc-400">Estado de aprendizaje general</p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-5 pb-5">
          <div className="flex flex-col sm:flex-row items-center justify-around gap-6">
            {/* SVG Donut */}
            <div className="relative w-32 h-32 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r={radius}
                  className="stroke-stone-100 dark:stroke-zinc-800"
                  strokeWidth="14"
                  fill="none"
                />
                {segments.map((seg, idx) => {
                  const fraction = seg.value / totalSegmented;
                  const dashLength = fraction * circumference;
                  const strokeDasharray = `${dashLength} ${circumference - dashLength}`;
                  const strokeDashoffset = -accumulatedOffset;
                  accumulatedOffset += dashLength;

                  if (seg.value === 0) return null;

                  return (
                    <circle
                      key={idx}
                      cx="50"
                      cy="50"
                      r={radius}
                      stroke={seg.color}
                      strokeWidth="14"
                      strokeDasharray={strokeDasharray}
                      strokeDashoffset={strokeDashoffset}
                      fill="none"
                      className="transition-all duration-500 ease-out"
                    />
                  );
                })}
              </svg>
              {/* Inner Center Info */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-xl font-bold tracking-tight text-stone-900 dark:text-zinc-100 leading-none">
                  {totalCards}
                </span>
                <span className="text-[10px] text-stone-400 dark:text-zinc-500 uppercase font-semibold mt-0.5">
                  Tarjetas
                </span>
              </div>
            </div>

            {/* Legend Breakdown */}
            <div className="space-y-2 w-full sm:w-auto">
              {segments.map((seg, idx) => {
                const percent = totalCards > 0 ? Math.round((seg.value / totalCards) * 100) : 0;
                return (
                  <div key={idx} className="flex items-center justify-between sm:justify-start gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${seg.bgClass}`} />
                      <span className="text-stone-600 dark:text-zinc-400 font-medium">
                        {seg.label}
                      </span>
                    </div>
                    <span className="font-semibold text-stone-800 dark:text-zinc-200">
                      {seg.value} <span className="text-stone-400 dark:text-zinc-500 text-[10px]">({percent}%)</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Line / Area Progress Chart */}
      <Card className="border border-stone-200 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
        <CardHeader className="pb-2 border-b border-stone-200/80 dark:border-zinc-800 bg-stone-50/60 dark:bg-zinc-950/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200/60 dark:border-blue-900/40">
                <TrendingUp className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold tracking-tight text-stone-900 dark:text-zinc-100">
                  Progreso de Estudio
                </CardTitle>
                <p className="text-[11px] text-stone-500 dark:text-zinc-400">Últimos 7 días de repaso</p>
              </div>
            </div>
            <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900/40 font-mono">
              +{studiedToday} hoy
            </span>
          </div>
        </CardHeader>

        <CardContent className="pt-3 pb-3">
          <div className="relative">
            <svg
              className="w-full overflow-visible"
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            >
              <defs>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563eb" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              <line
                x1={paddingX}
                y1={chartHeight - 15}
                x2={chartWidth - paddingX}
                y2={chartHeight - 15}
                className="stroke-stone-100 dark:stroke-zinc-800"
                strokeWidth="1"
              />
              <line
                x1={paddingX}
                y1={chartHeight / 2}
                x2={chartWidth - paddingX}
                y2={chartHeight / 2}
                className="stroke-stone-100 dark:stroke-zinc-800"
                strokeWidth="1"
                strokeDasharray="3 3"
              />

              {/* Area fill */}
              <path d={areaD} fill="url(#areaGradient)" />

              {/* Trend line */}
              <path
                d={pathD}
                fill="none"
                stroke="#2563eb"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Data points */}
              {points.map((p, idx) => (
                <g key={idx}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={hoveredPoint === idx ? 4.5 : 3}
                    className="fill-blue-600 stroke-white dark:stroke-zinc-900 transition-all duration-150 cursor-pointer"
                    strokeWidth="2"
                    onMouseEnter={() => setHoveredPoint(idx)}
                    onMouseLeave={() => setHoveredPoint(null)}
                  />
                  <text
                    x={p.x}
                    y={chartHeight + 4}
                    textAnchor="middle"
                    className="text-[9px] fill-stone-400 dark:fill-zinc-500 font-medium"
                  >
                    {p.day}
                  </text>
                </g>
              ))}
            </svg>

            {/* Hover tooltip */}
            {hoveredPoint !== null && (
              <div
                className="absolute z-10 -top-2 left-1/2 -translate-x-1/2 bg-stone-900 dark:bg-zinc-100 text-white dark:text-stone-900 text-[10px] font-medium px-2 py-0.5 rounded shadow-sm pointer-events-none"
              >
                {points[hoveredPoint].day}: {points[hoveredPoint].count} tarjetas
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
