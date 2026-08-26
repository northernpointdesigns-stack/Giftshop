import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { ChartPoint } from './AnimatedAreaChart';

interface AnimatedDonutProps {
  data: ChartPoint[];
  size?: number;
  thickness?: number;
  formatValue?: (v: number) => string;
  centerLabel?: string;
  ariaLabel?: string;
}

const PALETTE = ['#34d399', '#22d3ee', '#f59e0b', '#a78bfa', '#f472b6', '#60a5fa', '#f87171', '#4ade80'];

/**
 * Animated donut/pie chart with sweep-in animation, live center total
 * and a percentage legend. Pure SVG + motion — no chart dependency.
 */
export const AnimatedDonut: React.FC<AnimatedDonutProps> = ({
  data,
  size = 200,
  thickness = 26,
  formatValue = (v) => v.toFixed(2),
  centerLabel,
  ariaLabel = 'Sales share chart',
}) => {
  const total = useMemo(() => data.reduce((s, d) => s + d.value, 0), [data]);

  const segments = useMemo(() => {
    const r = (size - thickness) / 2;
    const C = 2 * Math.PI * r;
    let acc = 0;
    return data.map((d, i) => {
      const frac = total > 0 ? d.value / total : 0;
      const seg = {
        ...d,
        color: PALETTE[i % PALETTE.length],
        dashLen: frac * C,
        offset: -acc * C,
        pct: frac * 100,
        r,
        C,
      };
      acc += frac;
      return seg;
    });
  }, [data, total, size, thickness]);

  if (data.length === 0 || total <= 0) return null;

  return (
    <div className="flex items-center gap-5 flex-wrap justify-center">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={ariaLabel}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={(size - thickness) / 2}
            fill="none"
            stroke="#1E293B"
            strokeWidth={thickness}
          />
          {segments.map((s, i) => (
            <motion.circle
              key={s.label + i}
              cx={size / 2}
              cy={size / 2}
              r={s.r}
              fill="none"
              stroke={s.color}
              strokeWidth={thickness}
              strokeDasharray={`${s.dashLen} ${s.C - s.dashLen}`}
              initial={{ strokeDashoffset: s.offset, opacity: 0 }}
              animate={{ strokeDashoffset: s.offset, opacity: 1 }}
              transition={{ duration: 0.9, delay: i * 0.12, ease: 'easeOut' }}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              strokeLinecap="butt"
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
            {centerLabel || 'Total'}
          </div>
          <div className="text-lg font-black font-mono text-[#E2E8F0]">{formatValue(total)}</div>
        </div>
      </div>

      <div className="space-y-1.5 min-w-[140px]">
        {segments.map((s, i) => (
          <motion.div
            key={s.label + i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 + i * 0.08 }}
            className="flex items-center gap-2 text-xs"
          >
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
            <span className="text-slate-300 truncate max-w-[120px]">{s.label}</span>
            <span className="ml-auto font-mono text-slate-400 shrink-0">{s.pct.toFixed(1)}%</span>
            <span className="font-mono text-[#E2E8F0] font-bold shrink-0">{formatValue(s.value)}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
};