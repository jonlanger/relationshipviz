import { useState } from 'react';
import { scaleBand, scaleLinear } from 'd3';
import type { ThemeTokens } from '@/design-system/tokens';
import { useElementSize } from '@/lib/useElementSize';
import { ChartTooltip } from '../../molecules';
import styles from './charts.module.css';

export interface DegreeHistogramProps {
  data: { degree: number; count: number }[];
  tokens: ThemeTokens;
  height?: number;
}

/** Distribution of counterparties per company. A long right tail = a few hubs. */
export function DegreeHistogram({ data, tokens, height = 240 }: DegreeHistogramProps) {
  const [ref, { width }] = useElementSize();
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);
  const m = { top: 8, right: 4, bottom: 28, left: 32 };
  const iw = Math.max(0, width - m.left - m.right);
  const ih = height - m.top - m.bottom;
  const x = scaleBand<number>().domain(data.map((d) => d.degree)).range([0, iw]).paddingInner(0.18);
  const y = scaleLinear().domain([0, Math.max(...data.map((d) => d.count), 1)]).nice().range([ih, 0]);
  const color = tokens.viz.series[0];
  const every = Math.ceil(data.length / Math.max(1, Math.floor(iw / 28)));

  return (
    <div ref={ref} className={styles.frame} style={{ height }} onMouseLeave={() => setHover(null)}>
      {width > 0 && (
        <svg width={width} height={height} className={styles.svg} role="img" aria-label="Histogram of counterparties per company">
          <g transform={`translate(${m.left},${m.top})`}>
            {y.ticks(4).map((t) => (
              <g key={t}>
                <line className={styles.grid} x1={0} x2={iw} y1={y(t)} y2={y(t)} />
                <text className={styles.axisLabel} x={-8} y={y(t)} textAnchor="end" dominantBaseline="middle">{t}</text>
              </g>
            ))}
            {data.map((d, i) => {
              const bx = x(d.degree) ?? 0;
              const bw = x.bandwidth();
              const bh = ih - y(d.count);
              const r = Math.min(4, bw / 2, bh);
              return (
                <g
                  key={d.degree}
                  onMouseMove={(e) => {
                    const rect = e.currentTarget.ownerSVGElement!.getBoundingClientRect();
                    setHover({ i, x: e.clientX - rect.left, y: e.clientY - rect.top });
                  }}
                >
                  <rect className={styles.hit} x={bx} y={0} width={bw} height={ih} />
                  {d.count > 0 && (
                    <path
                      className={styles.mark}
                      opacity={hover && hover.i !== i ? 0.45 : 1}
                      d={`M${bx},${ih} v${-(bh - r)} a${r},${r} 0 0 1 ${r},${-r} h${bw - 2 * r} a${r},${r} 0 0 1 ${r},${r} v${bh - r} z`}
                      fill={color}
                    />
                  )}
                  {i % every === 0 && (
                    <text className={styles.axisLabel} x={bx + bw / 2} y={ih + 16} textAnchor="middle">{d.degree}</text>
                  )}
                </g>
              );
            })}
            <line className={styles.baseline} x1={0} x2={iw} y1={ih} y2={ih} />
          </g>
        </svg>
      )}
      {hover && data[hover.i] && (
        <ChartTooltip
          x={hover.x}
          y={hover.y}
          containerWidth={width}
          title={`${data[hover.i].degree} counterpart${data[hover.i].degree === 1 ? 'y' : 'ies'}`}
          rows={[{ label: 'Companies', value: data[hover.i].count, color }]}
        />
      )}
    </div>
  );
}
