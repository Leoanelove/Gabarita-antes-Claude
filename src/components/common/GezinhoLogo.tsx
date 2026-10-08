import React, { useId } from 'react';

interface GezinhoLogoProps {
  size?: number | string;
  className?: string;
  withText?: boolean;
  withBadge?: boolean;
  textColor?: string;
  subtitle?: string;
}

/**
 * GezinhoLogo - Logo oficial colorida do Gabarita
 * 
 * Estrutura de cores fixas:
 * - Quadrante Superior Esquerdo: Verde (#22C55E / #10B981)
 * - Quadrante Superior Direito: Azul (#38BDF8 / #3B82F6)
 * - Barra Central Direita: Rosa / Magenta (#FB7185 / #F43F5E)
 * - Quadrante Inferior Direito: Roxo / Violeta (#C084FC / #8B5CF6 / #7C3AED)
 * - Quadrante Inferior Esquerdo: Laranja (#F97316 / #FB923C / #EA580C)
 */
export const GezinhoLogo: React.FC<GezinhoLogoProps> = ({
  size = 40,
  className = '',
  withText = false,
  withBadge = false,
  textColor,
  subtitle = 'Estudos de Alto Rendimento',
}) => {
  const rawId = useId();
  // Sanitize id for SVG attribute compliance
  const id = rawId.replace(/[^a-zA-Z0-9_-]/g, '_');
  
  const greenId = `gezinho_green_${id}`;
  const blueId = `gezinho_blue_${id}`;
  const pinkId = `gezinho_pink_${id}`;
  const purpleId = `gezinho_purple_${id}`;
  const orangeId = `gezinho_orange_${id}`;

  const svgIcon = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      shapeRendering="geometricPrecision"
      className={`shrink-0 select-none ${className}`}
      aria-label="Logo Gabarita"
    >
      <defs>
        {/* 1. Verde (Top-Left) */}
        <linearGradient id={greenId} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#10B981" />
          <stop offset="40%" stopColor="#22C55E" />
          <stop offset="100%" stopColor="#4ADE80" />
        </linearGradient>

        {/* 2. Azul (Top-Right) */}
        <linearGradient id={blueId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="50%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#1D4ED8" />
        </linearGradient>

        {/* 3. Rosa / Magenta (Middle-Right G Bar) */}
        <linearGradient id={pinkId} x1="0%" y1="50%" x2="100%" y2="50%">
          <stop offset="0%" stopColor="#FB7185" />
          <stop offset="50%" stopColor="#F43F5E" />
          <stop offset="100%" stopColor="#EC4899" />
        </linearGradient>

        {/* 4. Roxo / Violeta (Bottom-Right) */}
        <linearGradient id={purpleId} x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#C084FC" />
          <stop offset="50%" stopColor="#8B5CF6" />
          <stop offset="100%" stopColor="#7C3AED" />
        </linearGradient>

        {/* 5. Laranja (Bottom-Left) */}
        <linearGradient id={orangeId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F97316" />
          <stop offset="50%" stopColor="#FB923C" />
          <stop offset="100%" stopColor="#EA580C" />
        </linearGradient>
      </defs>

      {/* Top-Left Quadrant: Verde */}
      <path
        d="M 4 50 A 46 46 0 0 1 50 4 L 50 27 A 23 23 0 0 0 27 50 Z"
        fill={`url(#${greenId})`}
      />

      {/* Top-Right Quadrant: Azul */}
      <path
        d="M 50 4 A 46 46 0 0 1 94.54 38.5 L 72.8 40.5 A 23 23 0 0 0 50 27 Z"
        fill={`url(#${blueId})`}
      />

      {/* Middle-Right Horizontal Bar / G Shelf: Rosa/Magenta */}
      <path
        d="M 94.54 38.5 A 46 46 0 0 1 96 50 A 46 46 0 0 1 94.54 61.5 L 48.5 61.5 A 11.5 11.5 0 0 1 48.5 38.5 Z"
        fill={`url(#${pinkId})`}
      />

      {/* Bottom-Right Quadrant: Roxo */}
      <path
        d="M 94.54 61.5 A 46 46 0 0 1 50 96 L 50 73 A 23 23 0 0 0 72.8 59.5 Z"
        fill={`url(#${purpleId})`}
      />

      {/* Bottom-Left Quadrant: Laranja */}
      <path
        d="M 50 96 A 46 46 0 0 1 4 50 L 27 50 A 23 23 0 0 0 50 73 Z"
        fill={`url(#${orangeId})`}
      />
    </svg>
  );

  if (!withText) {
    return svgIcon;
  }

  return (
    <div className="flex items-center gap-3">
      {svgIcon}
      <div>
        <div className="flex items-center gap-1.5">
          <span className={`font-extrabold text-lg tracking-tight ${textColor || 'text-slate-900 dark:text-slate-100'}`}>
            Gabarita
          </span>
          {withBadge && (
            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              PRO
            </span>
          )}
        </div>
        {subtitle && (
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium sidebar-motivational">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
};
