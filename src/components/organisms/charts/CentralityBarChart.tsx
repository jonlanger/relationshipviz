import { useState } from 'react';
import { scaleLinear } from 'd3';
import type { RankedCompany } from '@/data/aggregates';
import type { ThemeTokens } from '@/design-system/tokens';
import { sectorColor } from '@/lib/colors';
import { formatDecimal } from '@/lib/format';
import { useElementSize } from '@/lib/useElementSize';
import { ChartTooltip } from '../../molecules';
import styles from './charts.module.css';

export interface CentralityBarChartProps {
  data: RankedCompany[];
  tokens: ThemeTokens;
  valueLabel: string;
  format?: (v: number) => string;
  onSelect?: (id: string) => void;
}

const ROW = 26;
const BAR = 14;

/** Horizontal ranked bars. Bars carry sector color; names and values stay in text ink. */
export function CentralityBarChart({ data, tokens, valueLabel, format = (v) => formatDecimal(v, 3), onSelect }: CentralityBarChartProps) {
  const [ref, { width }] = useElementSize();
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);
  const LABEL = 104;
  const VALUE = 52;
  const height = data.length * ROW;
  const max = Math.max(...data.map((d) => d.value), 1e-9);
  const x = scaleLinear().domain([0, max]).range([0, Math.max(0, width - LABEL - VALUE)]);

  if (!data.length) return <div className={styles.empty}>No connected companies in view</div>;

  return (
    <div ref={ref} className={styles.frame} style={{ height }} onMouseLeave={() => setHover(null)}>
      {width > 0 && (
        <svg width={width} height={height} className={styles.svg} role="img" aria-label={`Top companies by ${valueLabel}`}>
          {x.ticks(4).map((t) => (
            <line key={t} className={styles.grid} x1={LABEL + x(t)} x2={LABEL + x(t)} y1={0} y2={height} />
          ))}
          <line className={styles.baseline} x1={LABEL} x2={LABEL} y1={0} y2={height} />
          {data.map((d, i) => {
            const y = i * ROW;
            const w = Math.max(2, x(d.value));
            return (
              <g
                key={d.company.id}
                className={styles.mark}
                opacity={hover && hover.i !== i ? 0.45 : 1}
                style={{ cursor: onSelect ? 'pointer' : undefined }}
                onClick={() => onSelect?.(d.company.id)}
                onMouseMove={(e) => {
                  const r = e.currentTarget.ownerSVGElement!.getBoundingClientRect();
                  setHover({ i, x: e.clientX - r.left, y: e.clientY - r.top });
                }}
              >
                <rect className={styles.hit} x={0} y={y} width={width} height={ROW} />
                <text x={LABEL - 10} y={y + ROW / 2} textAnchor="end" dominantBaseline="middle" className={styles.label}>
                  {d.company.shortName}
                </text>
                {/* 4px rounded data-end, square at the baseline */}
                <path
                  d={`M${LABEL},${y + (ROW - BAR) / 2} h${w - 4} a4,4 0 0 1 4,4 v${BAR - 8} a4,4 0 0 1 -4,4 h${-(w - 4)} z`}
                  fill={sectorColor(d.company.sector, tokens)}
                />
                <text x={LABEL + w + 8} y={y + ROW / 2} dominantBaseline="middle" className={styles.axisLabel}>
                  {format(d.value)}
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
          title={data[hover.i].company.name}
          rows={[
            { label: data[hover.i].company.sector, value: '', color: sectorColor(data[hover.i].company.sector, tokens) },
            { label: valueLabel, value: format(data[hover.i].value) },
          ]}
        />
      )}
    </div>
  );
}
