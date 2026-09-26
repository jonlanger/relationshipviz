import type { ReactNode } from 'react';
import { Swatch, Text } from '../../atoms';
import styles from './ChartTooltip.module.css';

export interface ChartTooltipRow {
  label: string;
  value: ReactNode;
  color?: string;
}

export interface ChartTooltipProps {
  /** Position in px, relative to the chart container. */
  x: number;
  y: number;
  title: ReactNode;
  rows?: ChartTooltipRow[];
  /** Container width, so the tooltip flips to stay inside. */
  containerWidth?: number;
}

/** Per-mark hover readout. Values in text ink; color only on the swatch. */
export function ChartTooltip({ x, y, title, rows = [], containerWidth }: ChartTooltipProps) {
  const flip = containerWidth != null && x > containerWidth - 200;
  return (
    <div
      className={styles.tooltip}
      role="presentation"
      style={{ left: x, top: y, transform: `translate(${flip ? 'calc(-100% - 12px)' : '12px'}, -50%)` }}
    >
      <Text variant="caption" weight="semibold" className={styles.title}>{title}</Text>
      {rows.map((r) => (
        <div key={r.label} className={styles.row}>
          {r.color && <Swatch color={r.color} size="sm" />}
          <Text variant="caption" tone="secondary" className={styles.label}>{r.label}</Text>
          <Text variant="caption" weight="medium" numeric>{r.value}</Text>
        </div>
      ))}
    </div>
  );
}
