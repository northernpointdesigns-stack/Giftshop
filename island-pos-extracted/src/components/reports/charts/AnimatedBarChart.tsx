import React from 'react';
import { motion } from 'motion/react';
import { ChartPoint } from './AnimatedAreaChart';

interface AnimatedBarChartProps {
  data: ChartPoint[];
  color?: string;
  formatValue?: (v: number) => string;
  ariaLabel?: string;
}

/**
 * Animated horizontal bar list for rankings (top brands, product lines...).
 * Bars grow in with a stagger; values label the row end.
 */
export const AnimatedBarChart: React.FC<AnimatedBarChartProps> = ({
  data,
  color = '#22d3ee',
  formatValue = (v) => v.toFixed(2),
  ariaLabel = 'Ranked bar chart',
}) => {
  if (data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="space-y-2.5" role="img" aria-label={ariaLabel}>
      {data.map((d, i) => (
        <div key={d.label + i} className="flex items-center gap-3 text-xs">
          <span className="w-24 sm:w-32 truncate text-slate-300 font-semibold" title={d.label}>
            {d.label}
          </span>
          <div className="flex-1 h-5 bg-[#0F1115] border border-[#1E293B] rounded-lg overflow-hidden">
            <motion.div
              className="h-full rounded-lg"
              style={{ background: `linear-gradient(90deg, ${color}55, ${color})` }}
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(2, (d.value / max) * 100)}%` }}
              transition={{ duration: 0.8, delay: i * 0.1, ease: 'easeOut' }}
            />
          </div>
          <span className="w-20 text-right font-mono font-bold text-[#E2E8F0] shrink-0">
            {formatValue(d.value)}
          </span>
        </div>
      ))}
    </div>
  );
};