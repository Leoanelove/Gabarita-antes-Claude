import React, { useState } from 'react';
import { Simulado } from '../../types';

interface SimuladoLineChartProps {
  simulados: Simulado[];
}

export const SimuladoLineChart: React.FC<SimuladoLineChartProps> = ({ simulados }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Ordena cronologicamente os simulados finalizados
  const sortedSimulados = React.useMemo(() => {
    return [...simulados]
      .filter(s => (s.accuracyRate !== undefined || s.totalCorrect !== undefined) && s.status === 'finalizado')
      .sort((a, b) => {
        const dateA = new Date(a.finishedAt || a.createdAt).getTime();
        const dateB = new Date(b.finishedAt || b.createdAt).getTime();
        return dateA - dateB;
      });
  }, [simulados]);

  if (sortedSimulados.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-center p-6 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
        <p className="text-sm font-semibold">Nenhum simulado finalizado registrado ainda.</p>
        <p className="text-xs text-slate-500 mt-1">
          Clique no botão <span className="text-indigo-500 font-bold">+ Novo Simulado</span> acima para registrar seu primeiro resultado.
        </p>
      </div>
    );
  }

  // Dimensões do SVG
  const width = 600;
  const height = 240;
  const paddingLeft = 46;
  const paddingRight = 30;
  const paddingTop = 28;
  const paddingBottom = 42;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const points = sortedSimulados.map((sim, index) => {
    const accuracy = sim.accuracyRate !== undefined 
      ? sim.accuracyRate 
      : sim.questionsCount > 0 
        ? Math.round(((sim.totalCorrect || 0) / sim.questionsCount) * 100) 
        : 0;

    const x = sortedSimulados.length === 1
      ? paddingLeft + chartWidth / 2
      : paddingLeft + (index / (sortedSimulados.length - 1)) * chartWidth;

    const y = paddingTop + chartHeight - (accuracy / 100) * chartHeight;

    const dateFormatted = new Date(sim.finishedAt || sim.createdAt).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
    });

    return {
      x,
      y,
      accuracy,
      sim,
      dateFormatted,
    };
  });

  // Gera o caminho suave SVG
  const linePath = points.length === 1
    ? `M ${points[0].x - 30} ${points[0].y} L ${points[0].x + 30} ${points[0].y}`
    : points.reduce((acc, point, i, arr) => {
        if (i === 0) return `M ${point.x} ${point.y}`;
        const prev = arr[i - 1];
        const cx1 = prev.x + (point.x - prev.x) / 2;
        const cy1 = prev.y;
        const cx2 = prev.x + (point.x - prev.x) / 2;
        const cy2 = point.y;
        return `${acc} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${point.x} ${point.y}`;
      }, '');

  // Área preenchida com degradê abaixo da curva
  const areaPath = points.length === 1
    ? ''
    : `${linePath} L ${points[points.length - 1].x} ${paddingTop + chartHeight} L ${points[0].x} ${paddingTop + chartHeight} Z`;

  // Média Geral
  const averageAccuracy = Math.round(
    points.reduce((acc, p) => acc + p.accuracy, 0) / points.length
  );
  const avgY = paddingTop + chartHeight - (averageAccuracy / 100) * chartHeight;

  // Evolução (Diferença entre o primeiro e o último)
  const firstRate = points[0]?.accuracy || 0;
  const lastRate = points[points.length - 1]?.accuracy || 0;
  const diffRate = lastRate - firstRate;

  return (
    <div className="space-y-3">
      {/* Header com estatísticas rápidas da evolução */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-xs" />
            <span className="text-slate-600 dark:text-slate-300 font-medium">
              Média Geral: <strong className="text-slate-900 dark:text-slate-100 font-bold">{averageAccuracy}%</strong>
            </span>
          </div>
          {points.length > 1 && (
            <div className="flex items-center gap-1">
              <span className="text-slate-500">Evolução:</span>
              <span
                className={`font-bold px-1.5 py-0.5 rounded text-[11px] ${
                  diffRate >= 0
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                    : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                }`}
              >
                {diffRate >= 0 ? `+${diffRate}%` : `${diffRate}%`}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 text-slate-400 text-[11px]">
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-dashed border-t-2 border-dashed border-slate-400/60 inline-block" />
            Linha Média ({averageAccuracy}%)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" />
            Simulado
          </span>
        </div>
      </div>

      {/* Container SVG */}
      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto max-h-64 select-none overflow-visible"
        >
          <defs>
            {/* Gradiente da área preenchida */}
            <linearGradient id="simuladoAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366F1" stopOpacity="0.32" />
              <stop offset="70%" stopColor="#10B981" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
            </linearGradient>

            {/* Gradiente da linha */}
            <linearGradient id="simuladoLineGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#6366F1" />
              <stop offset="50%" stopColor="#8B5CF6" />
              <stop offset="100%" stopColor="#10B981" />
            </linearGradient>

            {/* Sombra de destaque */}
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#6366F1" floodOpacity="0.4" />
            </filter>
          </defs>

          {/* Linhas horizontais de grade (0%, 25%, 50%, 75%, 100%) */}
          {[0, 25, 50, 75, 100].map(val => {
            const y = paddingTop + chartHeight - (val / 100) * chartHeight;
            return (
              <g key={val}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={width - paddingRight}
                  y2={y}
                  stroke="currentColor"
                  className="text-slate-200 dark:text-slate-800/80"
                  strokeWidth="1"
                  strokeDasharray={val === 0 || val === 100 ? '0' : '3 3'}
                />
                <text
                  x={paddingLeft - 8}
                  y={y + 3.5}
                  textAnchor="end"
                  className="text-[10px] font-semibold fill-slate-400 dark:fill-slate-500 font-mono"
                >
                  {val}%
                </text>
              </g>
            );
          })}

          {/* Linha de referência da Média Geral */}
          {points.length > 1 && (
            <line
              x1={paddingLeft}
              y1={avgY}
              x2={width - paddingRight}
              y2={avgY}
              stroke="#6366F1"
              strokeWidth="1.5"
              strokeDasharray="4 4"
              opacity="0.45"
            />
          )}

          {/* Área preenchida sob a curva */}
          {areaPath && (
            <path
              d={areaPath}
              fill="url(#simuladoAreaGrad)"
            />
          )}

          {/* Linha principal */}
          <path
            d={linePath}
            fill="none"
            stroke="url(#simuladoLineGrad)"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#glow)"
          />

          {/* Pontos interativos e labels de data no eixo X */}
          {points.map((p, idx) => {
            const isHovered = hoveredIndex === idx;
            return (
              <g
                key={idx}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                {/* Linha guia vertical no hover */}
                {isHovered && (
                  <line
                    x1={p.x}
                    y1={paddingTop}
                    x2={p.x}
                    y2={paddingTop + chartHeight}
                    stroke="#6366F1"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                    opacity="0.7"
                  />
                )}

                {/* Eixo X: Rótulo de Data */}
                <text
                  x={p.x}
                  y={height - 12}
                  textAnchor="middle"
                  className={`text-[10px] font-semibold transition-colors ${
                    isHovered 
                      ? 'fill-indigo-600 dark:fill-indigo-400 font-bold' 
                      : 'fill-slate-500 dark:fill-slate-400'
                  }`}
                >
                  {p.dateFormatted}
                </text>

                {/* Ponto externo (efeito de radar no hover) */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isHovered ? 8 : 5.5}
                  className="fill-white dark:fill-slate-900 transition-all duration-200"
                  stroke={p.accuracy >= 80 ? '#10B981' : p.accuracy >= 60 ? '#6366F1' : '#F59E0B'}
                  strokeWidth={isHovered ? 3.5 : 2.5}
                />

                {/* Ponto interno sólido */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isHovered ? 4 : 2.5}
                  className="transition-all duration-200"
                  fill={p.accuracy >= 80 ? '#10B981' : p.accuracy >= 60 ? '#6366F1' : '#F59E0B'}
                />

                {/* Label de percentual acima do ponto */}
                <text
                  x={p.x}
                  y={p.y - 10}
                  textAnchor="middle"
                  className={`text-[11px] font-extrabold font-mono transition-all ${
                    isHovered
                      ? 'fill-slate-900 dark:fill-white text-[12px]'
                      : 'fill-slate-700 dark:fill-slate-300'
                  }`}
                >
                  {p.accuracy}%
                </text>
              </g>
            );
          })}
        </svg>

        {/* Tooltip rico e flutuante ao passar o mouse */}
        {hoveredIndex !== null && points[hoveredIndex] && (
          <div
            className="absolute z-30 pointer-events-none -translate-x-1/2 bottom-12 bg-slate-950/95 text-white p-3 rounded-xl shadow-2xl border border-indigo-500/40 backdrop-blur-md min-w-[200px] text-xs space-y-1.5 transition-all"
            style={{
              left: `${(points[hoveredIndex].x / width) * 100}%`,
              bottom: `${height - points[hoveredIndex].y + 16}px`,
            }}
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1.5">
              <span className="font-bold text-white truncate max-w-[140px]">
                {points[hoveredIndex].sim.title}
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-indigo-500/30 text-indigo-300 border border-indigo-500/40">
                {points[hoveredIndex].sim.banca || 'Simulado'}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Aproveitamento:</span>
              <span className="font-extrabold text-emerald-400 font-mono text-sm">
                {points[hoveredIndex].accuracy}%
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1 pt-1 text-center text-[10px] font-bold">
              <div className="bg-emerald-500/15 text-emerald-400 p-1 rounded">
                ✓ {points[hoveredIndex].sim.totalCorrect || 0}
              </div>
              <div className="bg-rose-500/15 text-rose-400 p-1 rounded">
                ✗ {points[hoveredIndex].sim.totalWrong || 0}
              </div>
              <div className="bg-amber-500/15 text-amber-300 p-1 rounded">
                - {points[hoveredIndex].sim.totalBlank || 0}
              </div>
            </div>
            <div className="text-[10px] text-slate-400 pt-0.5 text-right font-mono">
              Total: {points[hoveredIndex].sim.questionsCount} questões • {points[hoveredIndex].sim.durationMinutes} min
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
