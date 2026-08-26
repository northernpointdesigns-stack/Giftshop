import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';

export interface ChartPoint {
  label: string;
  value: number;
}

interface AnimatedAreaChartProps {
  data: ChartPoint[];
  color?: string;
  height?: number;
  formatValue?: (v: number) => string;
  ariaLabel?: string;
}

const VIEW_W = 600;
const VIEW_H = 200;
const PAD = { top: 12, right: 10, bottom: 22, left: 10 };

/**
 * Lightweight live area chart: animated line draw-in + gradient fill,
 * hover tooltips, no external chart dependency (inline SVG + motion).
 */
export const AnimatedAreaChart: React.FC<AnimatedAreaChartProps> = ({
  data,
  color = '#34d399',
  height = 220,
  formatValue = (v) => v.toFixed(2),
  ariaLabel = 'Revenue trend chart',
}) => {
  const [active, setActive] = useState<number | null>(null);

  const { linePath, areaPath, points, maxValue } = useMemo(() => {
    const max = Math.max(...data.map((d) => d.value), 1);
    if (data.length === 0) return { linePath: '', areaPath: '', points: [], maxValue: max };
    const innerW = VIEW_W - PAD.left - PAD.right;
    const innerH = VIEW_H - PAD.top - PAD.bottom;
    const step = data.length > 1 ? innerW / (data.length - 1) : 0;
    const pts = data.map((d, i) => ({
      x: PAD.left + (data.length > 1 ? i * step : innerW / 2),
      y: PAD.top + innerH - (d.value / max) * innerH,
      label: d.label,
      value: d.value,
    }));
    const line = pts
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
      .join(' ');
    const area = `${line} L${pts[pts.length - 1].x.toFixed(2)},${VIEW_H - PAD.bottom} L${pts[0].x.toFixed(2)},${VIEW_H - PAD.bottom} Z`;
    return { linePath: line, areaPath: area, points: pts, maxValue: max };
  }, [data]);

  if (data.length === 0) return null;

  const labelEvery = Math.max(1, Math.ceil(points.length / 6));
  const activePoint = active !== null ? points[active] : null;

  return (
    <div className="relative w-full" style={{ height }}>
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="none"
        className="w-full h-full"
        role="img"
        aria-label={ariaLabel}
      >
        <defs>
          <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* horizontal gridlines */}
        {[0, 0.5, 1].map((f) => {
          const y = PAD.top + (VIEW_H - PAD.top - PAD.bottom) * f;
          return (
            <line
              key={f}
              x1={PAD.left}
              x2={VIEW_W - PAD.right}
              y1={y}
              y2={y}
              stroke="#1E293B"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
          );
        })}

        <motion.path
          d={areaPath}
          fill={`url(#grad-${color.replace('#', '')})`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.1, delay: 0.35 }}
        />
        <motion.path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.2, ease: 'easeInOut' }}
        />

        {/* hover hit zones + active dot */}
        {points.map((p, i) => (
          <rect
            key={p.label + i}
            x={p.x - (VIEW_W / points.length) / 2}
            y={0}
            width={VIEW_W / points.length}
            height={VIEW_H}
            fill="transparent"
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
          />
        ))}
        {activePoint && (
          <circle cx={activePoint.x} cy={activePoint.y} r="5" fill={color} stroke="#0F1115" strokeWidth="2" />
        )}
      </svg>

      {/* x-axis labels */}
      <div className="absolute bottom-0 left-0 right-0 flex justify-between px-2 pointer-events-none">
        {points
          .filter((_, i) => i % labelEvery === 0 || i === points.length - 1)
          .map((p, i) => (
            <span key={p.label + i} className="text-[9px] text-slate-500 font-mono">
              {p.label}
            </span>
          ))}
      </div>

      {/* tooltip */}
      {activePoint && (
        <div
          className="absolute -translate-x-1/2 bg-[#0F1115] border border-[#1E293B] rounded-lg px-2.5 py-1.5 pointer-events-none shadow-lg z-10"
          style={{
            left: `${(activePoint.x / VIEW_W) * 100}%`,
            top: `${Math.max(0, (activePoint.y / VIEW_H) * 100 - 22)}%`,
          }}
        >
          <div className="text-[10px] text-slate-400 font-semibold">{activePoint.label}</div>
          <div className="text-xs font-bold font-mono" style={{ color }}>
            {formatValue(activePoint.value)}
          </div>
        </div>
      )}

      {/* max scale hint */}
      <div className="absolute top-0 right-2 text-[9px] text-slate-600 font-mono pointer-events-none">
        {formatValue(maxValue)}
      </div>
    </div>
  );
};