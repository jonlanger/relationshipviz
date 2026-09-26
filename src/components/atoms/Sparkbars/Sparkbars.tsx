import clsx from 'clsx';
import styles from './Sparkbars.module.css';

export interface SparkbarsProps {
  values: (number | null)[];
  /** Accessible summary, e.g. "Revenue FY2021–FY2026, rising". */
  label: string;
  color?: string;
  width?: number;
  height?: number;
  className?: string;
}

/** Word-sized bar trend. Highlights the latest value; negatives drop below a baseline. */
export function Sparkbars({ values, label, color = 'var(--viz-series-1)', width = 72, height = 24, className }: SparkbarsProps) {
  const nums = values.map((v) => v ?? 0);
  const max = Math.max(...nums, 0);
  const min = Math.min(...nums, 0);
  const span = max - min || 1;
  const zero = height * (max / span);
  const gap = 2;
  const bw = Math.max(2, (width - gap * (nums.length - 1)) / Math.max(nums.length, 1));
  return (
    <svg width={width} height={height} className={clsx(styles.spark, className)} role="img" aria-label={label}>
      {nums.map((v, i) => {
        const h = Math.max(1, (Math.abs(v) / span) * height);
        const y = v >= 0 ? zero - h : zero;
        return (
          <rect
            key={i}
            x={i * (bw + gap)}
            y={y}
            width={bw}
            height={h}
            rx={1}
            fill={v < 0 ? 'var(--color-status-critical)' : color}
            opacity={i === nums.length - 1 ? 1 : 0.45}
          />
        );
      })}
    </svg>
  );
}
