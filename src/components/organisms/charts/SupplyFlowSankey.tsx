import { useMemo, useState } from 'react';
import { sankey, sankeyLinkHorizontal, type SankeyLink, type SankeyNode } from 'd3-sankey';
import type { Flow, FlowNode } from '@/data/aggregates';
import type { ThemeTokens } from '@/design-system/tokens';
import { sectorColor } from '@/lib/colors';
import { SECTOR_SHORT } from '@/lib/sectorLabels';
import { useElementSize } from '@/lib/useElementSize';
import { ChartTooltip } from '../../molecules';
import styles from './charts.module.css';

type N = SankeyNode<FlowNode, object>;
type L = SankeyLink<FlowNode, object>;

export interface SupplyFlowSankeyProps {
  flow: Flow;
  tokens: ThemeTokens;
  /** Company mode labels show company names; sector mode shows short sector names. */
  mode: 'company' | 'sector';
  onNodeClick?: (node: FlowNode) => void;
  height?: number;
}

/** Supplier → customer flows. Link width = summed relationship strength. */
export function SupplyFlowSankey({ flow, tokens, mode, onNodeClick, height = 420 }: SupplyFlowSankeyProps) {
  const [ref, { width }] = useElementSize();
  const [hover, setHover] = useState<{ link?: L; node?: N; x: number; y: number } | null>(null);
  const LABEL_W = mode === 'company' ? 110 : 120;

  const graph = useMemo(() => {
    if (!width || !flow.nodes.length) return null;
    const gen = sankey<FlowNode, object>()
      .nodeId((d) => d.id)
      .nodeWidth(10)
      .nodePadding(mode === 'company' ? 8 : 12)
      .nodeAlign((n) => (n as N & FlowNode).column === 0 ? 0 : (n as N & FlowNode).column === 2 ? (mode === 'company' ? 2 : 1) : 1)
      .extent([[LABEL_W, 8], [width - LABEL_W, height - 8]]);
    return gen({ nodes: flow.nodes.map((n) => ({ ...n })), links: flow.links.map((l) => ({ ...l })) });
  }, [flow, width, height, mode, LABEL_W]);

  if (!flow.nodes.length) return <div className={styles.empty} style={{ height }}>No supply relationships in view</div>;

  const isOn = (l: L) => {
    if (!hover) return true;
    if (hover.link) return hover.link === l;
    return hover.node === l.source || hover.node === l.target;
  };
  const pos = (e: React.MouseEvent) => {
    const r = (e.currentTarget as SVGElement).ownerSVGElement!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const label = (n: FlowNode) => (mode === 'sector' ? SECTOR_SHORT[n.sector] : n.label);

  return (
    <div ref={ref} className={styles.frame} style={{ height }} onMouseLeave={() => setHover(null)}>
      {graph && (
        <svg width={width} height={height} className={styles.svg} role="img" aria-label="Sankey diagram of supply flows">
          <g fill="none">
            {graph.links.map((l, i) => (
              <path
                key={i}
                d={sankeyLinkHorizontal()(l) ?? ''}
                stroke={sectorColor((l.source as N).sector, tokens)}
                strokeOpacity={isOn(l) ? 0.42 : 0.06}
                strokeWidth={Math.max(1.5, l.width ?? 1)}
                className={styles.mark}
                onMouseMove={(e) => setHover({ link: l, ...pos(e) })}
              />
            ))}
          </g>
          {graph.nodes.map((n) => {
            const left = n.column === 0;
            const center = n.column === 1;
            const h = Math.max(2, (n.y1 ?? 0) - (n.y0 ?? 0));
            return (
              <g
                key={n.id}
                style={{ cursor: onNodeClick && n.companyId ? 'pointer' : onNodeClick && mode === 'sector' ? 'pointer' : undefined }}
                onMouseMove={(e) => setHover({ node: n, ...pos(e) })}
                onClick={() => onNodeClick?.(n)}
              >
                <rect x={n.x0} y={n.y0} width={(n.x1 ?? 0) - (n.x0 ?? 0)} height={h} rx={2} fill={sectorColor(n.sector, tokens)} />
                <text
                  x={center ? ((n.x0 ?? 0) + (n.x1 ?? 0)) / 2 : left ? (n.x0 ?? 0) - 8 : (n.x1 ?? 0) + 8}
                  y={center ? (n.y0 ?? 0) - 8 : ((n.y0 ?? 0) + (n.y1 ?? 0)) / 2}
                  textAnchor={center ? 'middle' : left ? 'end' : 'start'}
                  dominantBaseline={center ? 'auto' : 'middle'}
                  className={center ? styles.labelStrong : styles.label}
                >
                  {label(n)}
                </text>
              </g>
            );
          })}
        </svg>
      )}
      {hover && (hover.link || hover.node) && (
        <ChartTooltip
          x={hover.x}
          y={hover.y}
          containerWidth={width}
          title={
            hover.link
              ? `${(hover.link.source as N).label} → ${(hover.link.target as N).label}`
              : hover.node!.label
          }
          rows={
            hover.link
              ? [{ label: 'Strength', value: (hover.link.value ?? 0).toFixed(2), color: sectorColor((hover.link.source as N).sector, tokens) }]
              : [
                  { label: hover.node!.column === 0 ? 'Supplies' : hover.node!.column === 2 ? 'Buys' : 'Total flow', value: (hover.node!.value ?? 0).toFixed(2), color: sectorColor(hover.node!.sector, tokens) },
                ]
          }
        />
      )}
    </div>
  );
}
