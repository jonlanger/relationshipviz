import { useMemo, useState } from 'react';
import { scaleLinear, scaleSqrt } from 'd3';
import type { Company } from '@/data/schema';
import { STANCE_META, type Stance } from '@/data/lenses';
import type { ThemeTokens } from '@/design-system/tokens';
import { stanceColor } from '@/lib/colors';
import { formatCompanyCap } from '@/lib/format';
import { useElementSize } from '@/lib/useElementSize';
import { ChartTooltip } from '../../molecules';
import styles from './charts.module.css';

export interface QuadrantPoint {
  company: Company;
  risk: number;
  opportunity: number;
  riskPct: number;
  opportunityPct: number;
  stance: Stance;
}

export interface LensQuadrantChartProps {
  data: QuadrantPoint[];
  tokens: ThemeTokens;
  height?: number;
  /** How many of the largest companies get a direct label. */
  labelCount?: number;
  onSelect?: (id: string) => void;
}

const M = { top: 16, right: 20, bottom: 40, left: 48 };

/** Risk (x) against opportunity (y); crosshairs at the medians split the four stances. */
export function LensQuadrantChart({ data, tokens, height = 440, labelCount = 14, onSelect }: LensQuadrantChartProps) {
  const [ref, { width }] = useElementSize();
  const [hover, setHover] = useState<string | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  const iw = Math.max(0, width - M.left - M.right);
  const ih = height - M.top - M.bottom;
  const x = scaleLinear().domain([0, 100]).range([0, iw]);
  const y = scaleLinear().domain([0, 100]).range([ih, 0]);
  const r = scaleSqrt().domain([0, Math.max(1, ...data.map((d) => d.company.marketCap))]).range([3, 18]);

  // The split sits at the lowest score that counts as "high" (percentile ≥ 0.5), so it matches the stances.
  const split = useMemo(() => {
    const lo = (pts: number[]) => (pts.length ? Math.min(...pts) : 50);
    return {
      risk: lo(data.filter((d) => d.riskPct >= 0.5).map((d) => d.risk)),
      opportunity: lo(data.filter((d) => d.opportunityPct >= 0.5).map((d) => d.opportunity)),
    };
  }, [data]);

  // Greedy placement, largest first: a label that would overlap one already placed is dropped
  // (it still shows on hover). Width is estimated from the 12px label font.
  const labeled = useMemo(() => {
    const placed: { x0: number; x1: number; y0: number; y1: number }[] = [];
    const out = new Set<string>();
    for (const d of [...data].sort((a, b) => b.company.marketCap - a.company.marketCap)) {
      if (out.size >= labelCount) break;
      const w = d.company.shortName.length * 6.6;
      const cx = x(d.risk);
      const by = y(d.opportunity) - r(d.company.marketCap) - 4;
      const box = { x0: cx - w / 2, x1: cx + w / 2, y0: by - 12, y1: by + 2 };
      if (placed.some((p) => box.x0 < p.x1 && box.x1 > p.x0 && box.y0 < p.y1 && box.y1 > p.y0)) continue;
      placed.push(box);
      out.add(d.company.id);
    }
    return out;
    // x, y and r are rebuilt each render from width/height/data; those are the real inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, labelCount, width, height]);
  // Draw large bubbles first so small ones stay clickable on top.
  const ordered = useMemo(() => [...data].sort((a, b) => b.company.marketCap - a.company.marketCap), [data]);
  const hovered = hover ? data.find((d) => d.company.id === hover) : null;

  if (!data.length) return <div className={styles.empty}>No companies in view</div>;

  const quadrants: { stance: Stance; x: number; y: number; anchor: 'start' | 'end' }[] = [
    { stance: 'add', x: 8, y: 14, anchor: 'start' },
    { stance: 'watch', x: iw - 8, y: 14, anchor: 'end' },
    { stance: 'hold', x: 8, y: ih - 8, anchor: 'start' },
    { stance: 'reduce', x: iw - 8, y: ih - 8, anchor: 'end' },
  ];

  return (
    <div ref={ref} className={styles.frame} style={{ height }} onMouseLeave={() => { setHover(null); setPos(null); }}>
      {width > 0 && (
        <svg width={width} height={height} className={styles.svg} role="img" aria-label="Risk against opportunity for each company">
          <g transform={`translate(${M.left},${M.top})`}>
            {[0, 25, 50, 75, 100].map((t) => (
              <g key={t}>
                <line className={styles.grid} x1={x(t)} x2={x(t)} y1={0} y2={ih} />
                <line className={styles.grid} x1={0} x2={iw} y1={y(t)} y2={y(t)} />
                <text className={styles.axisLabel} x={x(t)} y={ih + 16} textAnchor="middle">{t}</text>
                <text className={styles.axisLabel} x={-8} y={y(t)} textAnchor="end" dominantBaseline="middle">{t}</text>
              </g>
            ))}
            <line className={styles.baseline} x1={x(split.risk)} x2={x(split.risk)} y1={0} y2={ih} strokeDasharray="4 3" />
            <line className={styles.baseline} x1={0} x2={iw} y1={y(split.opportunity)} y2={y(split.opportunity)} strokeDasharray="4 3" />
            {quadrants.map((q) => (
              <text key={q.stance} x={q.x} y={q.y} textAnchor={q.anchor} className={styles.labelStrong}>
                {STANCE_META[q.stance].label}
              </text>
            ))}
            <text className={styles.label} x={iw / 2} y={ih + 34} textAnchor="middle">Risk →</text>
            <text className={styles.label} transform={`translate(${-36},${ih / 2}) rotate(-90)`} textAnchor="middle">Opportunity →</text>

            {ordered.map((d) => {
              const on = hover === d.company.id;
              return (
                <circle
                  key={d.company.id}
                  className={styles.mark}
                  cx={x(d.risk)}
                  cy={y(d.opportunity)}
                  r={r(d.company.marketCap)}
                  fill={stanceColor(d.stance, tokens)}
                  fillOpacity={hover && !on ? 0.25 : 0.8}
                  stroke={on ? tokens.text.primary : tokens.bg.surface1}
                  strokeWidth={on ? 2 : 1.5}
                  style={{ cursor: onSelect ? 'pointer' : undefined }}
                  onClick={() => onSelect?.(d.company.id)}
                  onMouseMove={(e) => {
                    const rect = e.currentTarget.ownerSVGElement!.getBoundingClientRect();
                    setHover(d.company.id);
                    setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                  }}
                />
              );
            })}
            {ordered
              .filter((d) => labeled.has(d.company.id) || hover === d.company.id)
              .map((d) => (
                <text
                  key={`l-${d.company.id}`}
                  x={x(d.risk)}
                  y={y(d.opportunity) - r(d.company.marketCap) - 4}
                  textAnchor="middle"
                  className={styles.label}
                  style={{ pointerEvents: 'none', paintOrder: 'stroke', stroke: tokens.bg.surface1, strokeWidth: 3 }}
                >
                  {d.company.shortName}
                </text>
              ))}
          </g>
        </svg>
      )}
      {hovered && pos && (
        <ChartTooltip
          x={pos.x}
          y={pos.y}
          containerWidth={width}
          title={hovered.company.name}
          rows={[
            { label: 'Stance', value: STANCE_META[hovered.stance].label, color: stanceColor(hovered.stance, tokens) },
            { label: 'Risk', value: Math.round(hovered.risk) },
            { label: 'Opportunity', value: Math.round(hovered.opportunity) },
            { label: 'Market cap', value: formatCompanyCap(hovered.company) },
          ]}
        />
      )}
    </div>
  );
}
