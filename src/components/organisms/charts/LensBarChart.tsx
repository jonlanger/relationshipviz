import { useState } from 'react';
import { scaleLinear } from 'd3';
import { useElementSize } from '@/lib/useElementSize';
import { ChartTooltip, type ChartTooltipRow } from '../../molecules';
import styles from './charts.module.css';

export interface LensBar {
  key: string;
  label: string;
  /** 0–100. */
  value: number;
  color: string;
  /** Extra tooltip lines (e.g. the top driver). */
  rows?: ChartTooltipRow[];
  tooltipTitle?: string;
}

export interface LensBarChartProps {
  data: LensBar[];
  valueLabel: string;
  /** Fixed scale max; defaults to 100 so bars compare across charts. */
  max?: number;
  onSelect?: (key: string) => void;
  ariaLabel: string;
}

const ROW = 26;
const BAR = 14;

/** Ranked horizontal bars on a 0–100 lens scale. Color from the lens ramp; names and values in text ink. */
export function LensBarChart({ data, valueLabel, max = 100, onSelect, ariaLabel }: LensBarChartProps) {
  const [ref, { width }] = useElementSize();
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);
  const LABEL = 112;
  const VALUE = 36;
  const height = data.length * ROW;
  const x = scaleLinear().domain([0, max]).range([0, Math.max(0, width - LABEL - VALUE)]);

  if (!data.length) return <div className={styles.empty}>No companies in view</div>;

  return (
    <div ref={ref} className={styles.frame} style={{ height }} onMouseLeave={() => setHover(null)}>
      {width > 0 && (
        <svg width={width} height={height} className={styles.svg} role="img" aria-label={ariaLabel}>
          {[25, 50, 75, 100].filter((t) => t <= max).map((t) => (
            <line key={t} className={styles.grid} x1={LABEL + x(t)} x2={LABEL + x(t)} y1={0} y2={height} />
          ))}
          <line className={styles.baseline} x1={LABEL} x2={LABEL} y1={0} y2={height} />
          {data.map((d, i) => {
            const y = i * ROW;
            const w = Math.max(4, x(d.value));
            return (
              <g
                key={d.key}
                className={styles.mark}
                opacity={hover && hover.i !== i ? 0.45 : 1}
                style={{ cursor: onSelect ? 'pointer' : undefined }}
                onClick={() => onSelect?.(d.key)}
                onMouseMove={(e) => {
                  const r = e.currentTarget.ownerSVGElement!.getBoundingClientRect();
                  setHover({ i, x: e.clientX - r.left, y: e.clientY - r.top });
                }}
              >
                <rect className={styles.hit} x={0} y={y} width={width} height={ROW} />
                <text x={LABEL - 10} y={y + ROW / 2} textAnchor="end" dominantBaseline="middle" className={styles.label}>
                  {d.label}
                </text>
                <path
                  d={`M${LABEL},${y + (ROW - BAR) / 2} h${w - 4} a4,4 0 0 1 4,4 v${BAR - 8} a4,4 0 0 1 -4,4 h${-(w - 4)} z`}
                  fill={d.color}
                />
                <text x={LABEL + w + 8} y={y + ROW / 2} dominantBaseline="middle" className={styles.axisLabel}>
                  {Math.round(d.value)}
                </text>
              </g>
            );
          })}
        </svg>
      )}
      {hover && data[hover.i] && (
        <ChartTooltip
          x={hover.x}
          y={hover.y}
          containerWidth={width}
          title={data[hover.i].tooltipTitle ?? data[hover.i].label}
          rows={[{ label: valueLabel, value: Math.round(data[hover.i].value), color: data[hover.i].color }, ...(data[hover.i].rows ?? [])]}
        />
      )}
    </div>
  );
}
