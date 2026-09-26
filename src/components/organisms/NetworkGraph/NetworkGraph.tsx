import { useCallback, useMemo, useState } from 'react';
import { SigmaContainer } from '@react-sigma/core';
import { EdgeArrowProgram, EdgeRectangleProgram } from 'sigma/rendering';
import clsx from 'clsx';
import { buildGraph, type EdgeAttrs, type NodeAttrs } from '@/data/graph';
import type { FilteredData } from '@/data/filters';
import type { NetworkMetrics } from '@/data/metrics';
import type { Dataset, Sector } from '@/data/schema';
import { useTheme } from '@/design-system';
import type { SectorCluster } from '@/lib/graph/layouts';
import type { ColorBy, LayoutMode, Lens } from '@/app/store';
import type { LensResult } from '@/data/lenses';
import type { GraphPaint } from '@/lib/graph/overlays';
import { Spinner, Text } from '../../atoms';
import { GraphController } from './GraphController';
import { GraphControls } from './GraphControls';
import { EdgeTooltip } from './EdgeTooltip';
import { GraphLegend } from './GraphLegend';
import { SectorLabels } from './SectorLabels';
import styles from './NetworkGraph.module.css';

export interface NetworkGraphProps {
  dataset: Dataset;
  filtered: FilteredData;
  metrics: NetworkMetrics;
  colorBy: ColorBy;
  lens: Lens;
  /** Scores for the filtered universe; required for the lens to show. */
  lenses: LensResult | null;
  /** Portfolio or scenario overlay. */
  paint?: GraphPaint | null;
  showIsolated?: boolean;
  layoutMode: LayoutMode;
  showLabels: boolean;
  selectedId: string | null;
  selectedEdge: string | null;
  hoveredId: string | null;
  onSelect: (id: string | null) => void;
  onSelectEdge: (key: string | null) => void;
  onHover: (id: string | null) => void;
  onSectorPick?: (sector: Sector) => void;
  className?: string;
}

/** WebGL network of companies (nodes) and relationships (edges). */
export function NetworkGraph({ dataset, onSectorPick, className, ...state }: NetworkGraphProps) {
  const { tokens } = useTheme();
  const graph = useMemo(() => buildGraph(dataset), [dataset]);
  const [pending, setPending] = useState(true);
  const [clusters, setClusters] = useState<SectorCluster[] | null>(null);

  const settings = useMemo(
    () => ({
      allowInvalidContainer: true,
      renderEdgeLabels: false,
      enableEdgeEvents: true,
      defaultEdgeType: 'line',
      edgeProgramClasses: { line: EdgeRectangleProgram, arrow: EdgeArrowProgram },
      labelRenderedSizeThreshold: 9,
      labelDensity: 0.6,
      labelGridCellSize: 90,
      zIndex: true,
      minCameraRatio: 0.08,
      maxCameraRatio: 3,
      stagePadding: 48,
    }),
    [],
  );

  const [edgeHover, setEdgeHover] = useState<{ edge: string; x: number; y: number } | null>(null);
  const onLayoutState = useCallback((p: boolean) => setPending(p), []);
  const onClusters = useCallback((c: SectorCluster[] | null) => setClusters(c), []);

  return (
    <div className={clsx(styles.root, className)}>
      <SigmaContainer<NodeAttrs, EdgeAttrs> graph={graph} settings={settings} className={styles.sigma}>
        <GraphController
          graph={graph}
          tokens={tokens}
          onLayoutState={onLayoutState}
          onClusters={onClusters}
          onEdgeHover={setEdgeHover}
          {...state}
        />
        {clusters && onSectorPick && <SectorLabels clusters={clusters} onPick={onSectorPick} />}
        <GraphControls background={tokens.bg.canvas} />
      </SigmaContainer>
      <GraphLegend colorBy={state.colorBy} lens={state.lenses ? state.lens : 'off'} paint={state.paint} filtered={state.filtered} metrics={state.metrics} />
      {edgeHover && graph.hasEdge(edgeHover.edge) && (
        <EdgeTooltip
          attrs={graph.getEdgeAttributes(edgeHover.edge)}
          visibleIds={state.filtered.relationshipIds}
          names={(id) => graph.getNodeAttribute(id, 'label')}
          lens={state.lens}
          lenses={state.lenses}
          x={edgeHover.x}
          y={edgeHover.y}
        />
      )}
      <div className={clsx(styles.pending, pending && styles.pendingVisible)} role="status" aria-live="polite">
        {pending && (
          <>
            <Spinner size="sm" />
            <Text variant="caption" tone="secondary">Computing layout…</Text>
          </>
        )}
      </div>
    </div>
  );
}
