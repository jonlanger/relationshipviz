import { useMemo, useState } from 'react';
import { arc as d3arc, chord as d3chord, ribbon as d3ribbon, descending } from 'd3';
import { SECTORS, type Sector } from '@/data/schema';
import type { ThemeTokens } from '@/design-system/tokens';
import { sectorColor } from '@/lib/colors';
import { SECTOR_SHORT } from '@/lib/sectorLabels';
import { useElementSize } from '@/lib/useElementSize';
import { ChartTooltip } from '../../molecules';
import styles from './charts.module.css';

export interface SectorChordChartProps {
  matrix: number[][];
  tokens: ThemeTokens;
  onSectorPick?: (s: Sector) => void;
  height?: number;
}

/** Sector × sector dependency: arc length = a sector's links; ribbons = links between two sectors. */
export function SectorChordChart({ matrix, tokens, onSectorPick, height = 420 }: SectorChordChartProps) {
  const [ref, { width }] = useElementSize();
  const [hover, setHover] = useState<{ i: number; j?: number; x: number; y: number } | null>(null);

  // Drop empty sectors so they don't take a slot on the ring.
  const idx = useMemo(() => SECTORS.map((_, i) => i).filter((i) => matrix[i].some((v) => v > 0)), [matrix]);
  const sub = useMemo(() => idx.map((i) => idx.map((j) => matrix[i][j])), [idx, matrix]);
  const size = Math.min(width, height);
  const outer = size / 2 - 64;
  const inner = outer - 10;

  const chords = useMemo(() => d3chord().padAngle(0.035).sortSubgroups(descending)(sub), [sub]);
  const arcGen = d3arc<{ startAngle: number; endAngle: number }>().innerRadius(inner).outerRadius(outer).cornerRadius(2);
  const ribbonGen = d3ribbon<unknown, { startAngle: number; endAngle: number; radius: number }>().radius(inner - 2);
  const total = sub.reduce((a, row, i) => a + row.slice(i).reduce((x, y) => x + y, 0), 0);

  if (!idx.length) return <div className={styles.empty}>No relationships in view</div>;

  const sectorOf = (k: number) => SECTORS[idx[k]];
  const active = (i: number, j: number) => !hover || hover.i === i || hover.i === j || (hover.j != null && (hover.j === i || hover.j === j));

  return (
    <div ref={ref} className={styles.frame} style={{ height }} onMouseLeave={() => setHover(null)}>
      {width > 0 && (
        <svg width={width} height={height} className={styles.svg} role="img" aria-label="Chord diagram of relationships between sectors">
          <g transform={`translate(${width / 2}, ${height / 2})`}>
            {chords.map((c, k) => {
              const on = !hover || (hover.j == null ? hover.i === c.source.index || hover.i === c.target.index : (hover.i === c.source.index && hover.j === c.target.index));
              return (
                <path
                  key={k}
                  d={ribbonGen({ source: { ...c.source, radius: inner - 2 }, target: { ...c.target, radius: inner - 2 } } as never) as unknown as string}
                  fill={sectorColor(sectorOf(c.source.index), tokens)}
                  fillOpacity={on ? 0.55 : 0.06}
                  stroke={tokens.bg.surface1}
                  strokeWidth={0.75}
                  className={styles.mark}
                  onMouseMove={(e) => {
                    const r = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                    setHover({ i: c.source.index, j: c.target.index, x: e.clientX - r.left, y: e.clientY - r.top });
                  }}
                />
              );
            })}
            {chords.groups.map((g) => {
              const s = sectorOf(g.index);
              const mid = (g.startAngle + g.endAngle) / 2;
              const flip = mid > Math.PI;
              const lr = outer + 10;
              return (
                <g key={g.index} className={styles.mark} opacity={active(g.index, g.index) ? 1 : 0.3}>
                  <path
                    d={arcGen(g) ?? ''}
                    fill={sectorColor(s, tokens)}
                    stroke={tokens.bg.surface1}
                    strokeWidth={2}
                    style={{ cursor: onSectorPick ? 'pointer' : undefined }}
                    onMouseMove={(e) => {
                      const r = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                      setHover({ i: g.index, x: e.clientX - r.left, y: e.clientY - r.top });
                    }}
                    onClick={() => onSectorPick?.(s)}
                  />
                  {g.endAngle - g.startAngle > 0.08 && (
                    <text
                      className={styles.label}
                      transform={`rotate(${(mid * 180) / Math.PI - 90}) translate(${lr},0)${flip ? ' rotate(180)' : ''}`}
                      textAnchor={flip ? 'end' : 'start'}
                      dominantBaseline="middle"
                    >
                      {SECTOR_SHORT[s]}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      )}
      {hover && (
        <ChartTooltip
          x={hover.x}
          y={hover.y}
          containerWidth={width}
          title={hover.j == null || hover.i === hover.j ? sectorOf(hover.i) : `${SECTOR_SHORT[sectorOf(hover.i)]} ↔ ${SECTOR_SHORT[sectorOf(hover.j)]}`}
          rows={
            hover.j == null
              ? [
                  { label: 'Relationships', value: sub[hover.i].reduce((a, b) => a + b, 0), color: sectorColor(sectorOf(hover.i), tokens) },
                  { label: 'Within sector', value: sub[hover.i][hover.i] },
                ]
              : [
                  { label: 'Relationships', value: sub[hover.i][hover.j], color: sectorColor(sectorOf(hover.i), tokens) },
                  { label: 'Share of all', value: `${Math.round((sub[hover.i][hover.j] / Math.max(total, 1)) * 100)}%` },
                ]
          }
        />
      )}
    </div>
  );
}
