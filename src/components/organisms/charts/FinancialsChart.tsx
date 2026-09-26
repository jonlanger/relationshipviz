import { useState } from 'react';
import { scaleBand, scaleLinear } from 'd3';
import type { Financials } from '@/data/schema';
import type { ThemeTokens } from '@/design-system/tokens';
import { formatMoney } from '@/lib/format';
import { useElementSize } from '@/lib/useElementSize';
import { ChartTooltip, Legend } from '../../molecules';
import styles from './charts.module.css';

type Key = 'revenue' | 'netIncome' | 'rnd';
const LABEL: Record<Key, string> = { revenue: 'Revenue', netIncome: 'Net income', rnd: 'R&D' };

export interface FinancialsChartProps {
  financials: Financials;
  tokens: ThemeTokens;
  height?: number;
}

/** Grouped annual bars on one currency axis. Series use fixed categorical slots 1–3. */
export function FinancialsChart({ financials, tokens, height = 240 }: FinancialsChartProps) {
  const [ref, { width }] = useElementSize();
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);
  const { annual, currency } = financials;
  const keys = (['revenue', 'netIncome', 'rnd'] as Key[]).filter((k) => annual.some((y) => y[k] != null));
  const color: Record<Key, string> = { revenue: tokens.viz.series[0], netIncome: tokens.viz.series[1], rnd: tokens.viz.series[2] };

  const m = { top: 8, right: 4, bottom: 24, left: 56 };
  const iw = Math.max(0, width - m.left - m.right);
  const ih = height - m.top - m.bottom;
  const vals = annual.flatMap((y) => keys.map((k) => y[k] ?? 0));
  const y = scaleLinear().domain([Math.min(0, ...vals), Math.max(0, ...vals)]).nice().range([ih, 0]);
  const x0 = scaleBand<number>().domain(annual.map((a) => a.fiscalYear)).range([0, iw]).paddingInner(0.28).paddingOuter(0.1);
  const x1 = scaleBand<Key>().domain(keys).range([0, x0.bandwidth()]).paddingInner(0.12);

  return (
    <div>
      <div ref={ref} className={styles.frame} style={{ height }} onMouseLeave={() => setHover(null)}>
        {width > 0 && (
          <svg width={width} height={height} className={styles.svg} role="img" aria-label={`Annual ${keys.map((k) => LABEL[k]).join(', ')} in ${currency}`}>
            <g transform={`translate(${m.left},${m.top})`}>
              {y.ticks(4).map((t) => (
                <g key={t}>
                  <line className={styles.grid} x1={0} x2={iw} y1={y(t)} y2={y(t)} />
                  <text className={styles.axisLabel} x={-8} y={y(t)} textAnchor="end" dominantBaseline="middle">
                    {formatMoney(t, currency)}
                  </text>
                </g>
              ))}
              {annual.map((a, i) => (
                <g
                  key={a.fiscalYear}
                  transform={`translate(${x0(a.fiscalYear)},0)`}
                  onMouseMove={(e) => {
                    const r = e.currentTarget.ownerSVGElement!.getBoundingClientRect();
                    setHover({ i, x: e.clientX - r.left, y: e.clientY - r.top });
                  }}
                >
                  <rect className={styles.hit} x={0} y={0} width={x0.bandwidth()} height={ih} />
                  {keys.map((k) => {
                    const v = a[k];
                    if (v == null) return null;
                    const top = y(Math.max(0, v));
                    const h = Math.max(1, Math.abs(y(v) - y(0)));
                    return (
                      <rect
                        key={k}
                        className={styles.mark}
                        x={x1(k)}
                        y={top}
                        width={x1.bandwidth()}
                        height={h}
                        rx={2}
                        fill={v < 0 ? tokens.status.critical : color[k]}
                        opacity={hover && hover.i !== i ? 0.4 : 1}
                      />
                    );
                  })}
                  <text className={styles.axisLabel} x={x0.bandwidth() / 2} y={ih + 16} textAnchor="middle">
                    FY{String(a.fiscalYear).slice(2)}
                  </text>
                </g>
              ))}
              <line className={styles.baseline} x1={0} x2={iw} y1={y(0)} y2={y(0)} />
            </g>
          </svg>
        )}
        {hover && annual[hover.i] && (
          <ChartTooltip
            x={hover.x}
            y={hover.y}
            containerWidth={width}
            title={`Fiscal ${annual[hover.i].fiscalYear} · ended ${annual[hover.i].end}`}
            rows={keys.map((k) => ({
              label: LABEL[k],
              value: annual[hover.i][k] != null ? formatMoney(annual[hover.i][k]!, currency) : '—',
              color: color[k],
            }))}
          />
        )}
      </div>
      <Legend
        className={styles.legendRow}
        orientation="horizontal"
        shape="square"
        entries={keys.map((k) => ({ key: k, label: LABEL[k], color: color[k] }))}
      />
    </div>
  );
}
