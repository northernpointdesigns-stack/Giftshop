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

const VIEW_W = 640;
const VIEW_H = 240;
const PAD = { top: 18, right: 16, bottom: 36, left: 56 };

/** Live area chart with Y-axis, meet aspect ratio, single-point bar mode. */
export const AnimatedAreaChart: React.FC<AnimatedAreaChartProps> = ({
  data,
  color = '#34d399',
  height = 240,
  formatValue = (v) => v.toFixed(2),
  ariaLabel = 'Revenue trend chart',
}) => {
  const [active, setActive] = useState<number | null>(null);
  const gradId = `grad-${color.replace('#', '')}`;

  const { linePath, areaPath, points, maxValue, yTicks } = useMemo(() => {
    const max = Math.max(...data.map((d) => d.value), 1);
    if (data.length === 0) {
      return { linePath: '', areaPath: '', points: [] as Array<{ x: number; y: number; label: string; value: number }>, maxValue: max, yTicks: [] as number[] };
    }
    const innerW = VIEW_W - PAD.left - PAD.right;
    const innerH = VIEW_H - PAD.top - PAD.bottom;
    const step = data.length > 1 ? innerW / (data.length - 1) : 0;
    const pts = data.map((d, i) => ({
      x: PAD.left + (data.length > 1 ? i * step : innerW / 2),
      y: PAD.top + innerH - (d.value / max) * innerH,
      label: d.label,
      value: d.value,
    }));
    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
    const area = pts.length === 1 ? '' : `${line} L${pts[pts.length - 1].x.toFixed(2)},${VIEW_H - PAD.bottom} L${pts[0].x.toFixed(2)},${VIEW_H - PAD.bottom} Z`;
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => max * (1 - f));
    return { linePath: line, areaPath: area, points: pts, maxValue: max, yTicks: ticks };
  }, [data]);

  if (data.length === 0) return null;

  const labelEvery = Math.max(1, Math.ceil(points.length / 8));
  const activePoint = active !== null ? points[active] : null;
  const singlePoint = points.length === 1;
  const barW = Math.min(48, (VIEW_W - PAD.left - PAD.right) * 0.2);

  return (
    <div className="relative w-full select-none" style={{ height }}>
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-full"
        role="img"
        aria-label={ariaLabel}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.4" />
            <stop offset="100%" stopColor={color} stopOpacity="0.03" />
          </linearGradient>
        </defs>

        {yTicks.map((tickVal, i) => {
          const f = i / Math.max(yTicks.length - 1, 1);
          const y = PAD.top + (VIEW_H - PAD.top - PAD.bottom) * f;
          return (
            <g key={`y-${i}`}>
              <line x1={PAD.left} x2={VIEW_W - PAD.right} y1={y} y2={y} stroke="#1E293B" strokeWidth="1" strokeDasharray="4 4" />
              <text x={PAD.left - 8} y={y + 3} textAnchor="end" fill="#64748b" fontSize="10" fontFamily="ui-monospace, monospace">
                {formatValue(tickVal)}
              </text>
            </g>
          );
        })}

        <line x1={PAD.left} x2={VIEW_W - PAD.right} y1={VIEW_H - PAD.bottom} y2={VIEW_H - PAD.bottom} stroke="#334155" strokeWidth="1" />

        {singlePoint ? (
          <g>
            <motion.rect
              x={points[0].x - barW / 2}
              width={barW}
              y={points[0].y}
              height={Math.max(2, VIEW_H - PAD.bottom - points[0].y)}
              rx={6}
              fill={color}
              fillOpacity={0.35}
              initial={{ height: 0, y: VIEW_H - PAD.bottom }}
              animate={{ height: Math.max(2, VIEW_H - PAD.bottom - points[0].y), y: points[0].y }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
            />
            <motion.circle
              cx={points[0].x}
              cy={points[0].y}
              r={7}
              fill={color}
              stroke="#0F1115"
              strokeWidth={2}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, type: 'spring', stiffness: 260 }}
            />
          </g>
        ) : (
          <>
            <motion.path d={areaPath} fill={`url(#${gradId})`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.9, delay: 0.2 }} />
            <motion.path d={linePath} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.1, ease: 'easeInOut' }} />
            {points.map((p, i) => (
              <circle key={`dot-${i}`} cx={p.x} cy={p.y} r={active === i ? 5 : 3} fill={color} stroke="#0F1115" strokeWidth={1.5} opacity={active === null || active === i ? 1 : 0.45} />
            ))}
          </>
        )}

        {points.map((p, i) => {
          const slot = points.length > 1 ? (VIEW_W - PAD.left - PAD.right) / (points.length - 1) : VIEW_W - PAD.left - PAD.right;
          return (
            <rect
              key={`hit-${i}`}
              x={p.x - slot / 2}
              y={PAD.top}
              width={Math.max(slot, 24)}
              height={VIEW_H - PAD.top - PAD.bottom}
              fill="transparent"
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              style={{ cursor: 'crosshair' }}
            />
          );
        })}

        {points.map((p, i) => {
          if (!(i % labelEvery === 0 || i === points.length - 1)) return null;
          return (
            <text key={`x-${i}`} x={p.x} y={VIEW_H - 12} textAnchor="middle" fill="#64748b" fontSize="10" fontFamily="ui-monospace, monospace">
              {p.label}
            </text>
          );
        })}
      </svg>

      {activePoint && (
        <div
          className="absolute -translate-x-1/2 bg-[#0F1115] border border-[#1E293B] rounded-lg px-2.5 py-1.5 pointer-events-none shadow-lg z-10"
          style={{
            left: `${(activePoint.x / VIEW_W) * 100}%`,
            top: `${Math.max(4, (activePoint.y / VIEW_H) * 100 - 14)}%`,
          }}
        >
          <div className="text-[10px] text-slate-400 font-semibold">{activePoint.label}</div>
          <div className="text-xs font-bold font-mono" style={{ color }}>
            {formatValue(activePoint.value)}
          </div>
        </div>
      )}

      <div className="absolute top-1 right-2 text-[9px] text-slate-500 font-mono pointer-events-none">
        max {formatValue(maxValue)}
      </div>
    </div>
  );
};
