import { useEffect, useMemo, useRef, useState } from 'react';
import { useRegisterEvents, useSigma } from '@react-sigma/core';
import { animateNodes } from 'sigma/utils';
import type { EdgeAttrs, NodeAttrs, RelGraph } from '@/data/graph';
import type { FilteredData } from '@/data/filters';
import type { NetworkMetrics } from '@/data/metrics';
import type { RelationshipType } from '@/data/schema';
import type { ThemeTokens } from '@/design-system/tokens';
import { communityColor, lensColor, relationshipColor, sectorColor } from '@/lib/colors';
import type { LensResult } from '@/data/lenses';
import type { GraphPaint } from '@/lib/graph/overlays';
import { flatten, makeHoverRenderer, makeLabelRenderer } from '@/lib/graph/drawing';
import { computeForceLayout, computeSectorLayout, type Positions, type SectorCluster } from '@/lib/graph/layouts';
import type { ColorBy, LayoutMode, Lens } from '@/app/store';

export interface GraphControllerProps {
  graph: RelGraph;
  filtered: FilteredData;
  metrics: NetworkMetrics;
  tokens: ThemeTokens;
  colorBy: ColorBy;
  lens: Lens;
  lenses: LensResult | null;
  /** Portfolio or scenario overlay; wins over the lens and "Color by". */
  paint?: GraphPaint | null;
  /** Show companies with no visible relationships. */
  showIsolated?: boolean;
  layoutMode: LayoutMode;
  showLabels: boolean;
  selectedId: string | null;
  selectedEdge: string | null;
  hoveredId: string | null;
  onSelect: (id: string | null) => void;
  onSelectEdge: (key: string | null) => void;
  onHover: (id: string | null) => void;
  /** Edge hover, with viewport coordinates for the tooltip. */
  onEdgeHover: (hover: { edge: string; x: number; y: number } | null) => void;
  onLayoutState: (pending: boolean) => void;
  onClusters: (clusters: SectorCluster[] | null) => void;
}

const forceCache = new WeakMap<RelGraph, Promise<Positions>>();

/** Wires store state into sigma: reducers for filtering/focus/color, events, camera and layout. */
export function GraphController({
  graph,
  filtered,
  metrics,
  tokens,
  colorBy,
  lens,
  lenses,
  paint = null,
  showIsolated = true,
  layoutMode,
  showLabels,
  selectedId,
  selectedEdge,
  hoveredId,
  onSelect,
  onSelectEdge,
  onHover,
  onEdgeHover,
  onLayoutState,
  onClusters,
}: GraphControllerProps) {
  const sigma = useSigma<NodeAttrs, EdgeAttrs>();
  const registerEvents = useRegisterEvents<NodeAttrs, EdgeAttrs>();
  const cancelAnim = useRef<(() => void) | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null);
  /** Bumped when a layout animation finishes, so camera framing re-targets final positions. */
  const [layoutTick, setLayoutTick] = useState(0);

  // ---------- Events ----------
  useEffect(() => {
    registerEvents({
      clickNode: ({ node }) => onSelect(node),
      clickStage: () => onSelect(null),
      enterNode: ({ node }) => {
        onHover(node);
        sigma.getContainer().style.cursor = 'pointer';
      },
      leaveNode: () => {
        onHover(null);
        sigma.getContainer().style.cursor = '';
      },
      clickEdge: ({ edge }) => {
        onEdgeHover(null);
        onSelectEdge(edge);
      },
      enterEdge: ({ edge, event }) => {
        setHoveredEdge(edge);
        onEdgeHover({ edge, x: event.x, y: event.y });
        sigma.getContainer().style.cursor = 'pointer';
      },
      leaveEdge: () => {
        setHoveredEdge(null);
        onEdgeHover(null);
        sigma.getContainer().style.cursor = '';
      },
    });
  }, [registerEvents, onSelect, onSelectEdge, onHover, onEdgeHover, sigma]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !(e.target as HTMLElement).closest('input')) onSelect(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onSelect]);

  // ---------- Layout ----------
  useEffect(() => {
    let cancelled = false;
    const apply = (positions: Positions) => {
      cancelAnim.current?.();
      cancelAnim.current = animateNodes(graph, positions, { duration: 700, easing: 'cubicInOut' }, () =>
        setLayoutTick((t) => t + 1),
      );
    };
    if (layoutMode === 'sector') {
      const { positions, clusters } = computeSectorLayout(graph);
      apply(positions);
      onClusters(clusters);
      onLayoutState(false);
    } else {
      onClusters(null);
      let p = forceCache.get(graph);
      if (!p) {
        p = computeForceLayout(graph);
        forceCache.set(graph, p);
      }
      onLayoutState(true);
      p.then((positions) => {
        if (cancelled) return;
        apply(positions);
        onLayoutState(false);
      }).catch(() => onLayoutState(false));
    }
    return () => {
      cancelled = true;
    };
  }, [graph, layoutMode, onClusters, onLayoutState]);

  // ---------- Visibility & focus ----------
  const visibleEdges = useMemo(() => {
    const m = new Map<string, RelationshipType>();
    graph.forEachEdge((key, a) => {
      const vis = a.relationships.find((r) => filtered.relationshipIds.has(r.id));
      if (vis) m.set(key, vis.type);
    });
    return m;
  }, [graph, filtered]);

  const edgeEnds = useMemo(
    () => (selectedEdge && graph.hasEdge(selectedEdge) ? graph.extremities(selectedEdge) : null),
    [selectedEdge, graph],
  );
  const focusId = hoveredId ?? (edgeEnds ? null : selectedId);
  const focusNeighbors = useMemo(() => {
    if (!focusId || !graph.hasNode(focusId)) return null;
    const s = new Set<string>();
    graph.forEachEdge(focusId, (key, _a, source, target) => {
      if (visibleEdges.has(key)) s.add(source === focusId ? target : source);
    });
    return s;
  }, [focusId, graph, visibleEdges]);

  // Companies with at least one visible link (the rest are hidden unless showIsolated).
  const connected = useMemo(() => {
    const s = new Set<string>();
    for (const key of visibleEdges.keys()) for (const n of graph.extremities(key)) s.add(n);
    return s;
  }, [graph, visibleEdges]);

  // Overlay link colors per pair: the painted relationship among the pair's visible ones.
  const paintEdges = useMemo(() => {
    if (!paint) return null;
    const m = new Map<string, string>();
    graph.forEachEdge((key, a) => {
      const r = a.relationships.find((x) => filtered.relationshipIds.has(x.id) && paint.edges.has(x.id));
      if (r) m.set(key, paint.edges.get(r.id)!);
    });
    return m;
  }, [paint, graph, filtered]);

  // Lens: strongest per-pair contribution among visible relationships, 0–1.
  const lensKind = lens !== 'off' && lenses ? lens : null;
  const edgeLens = useMemo(() => {
    if (!lensKind || !lenses) return null;
    const m = new Map<string, number>();
    graph.forEachEdge((key, a) => {
      let v = 0;
      for (const r of a.relationships) {
        if (filtered.relationshipIds.has(r.id)) v = Math.max(v, lenses.byRel.get(r.id)?.[lensKind] ?? 0);
      }
      m.set(key, v);
    });
    return m;
  }, [lensKind, lenses, graph, filtered]);

  // ---------- Reducers ----------
  useEffect(() => {
    const neutral = tokens.viz.neutralNode;
    /** Links below this share of the strongest driver stay neutral, so the tint marks what matters. */
    const LENS_EDGE_MIN = 0.15;
    const lensEdge = (edge: string, strong: boolean) => {
      const v = edgeLens?.get(edge) ?? 0;
      if (!lensKind || v < LENS_EDGE_MIN) return null;
      const c = lensColor(lensKind, 0.5 + v / 2, tokens);
      return strong ? c : flatten(c, tokens.bg.canvas, 0.35 + 0.5 * v);
    };

    sigma.setSetting('nodeReducer', (node, data) => {
      const res: Partial<typeof data> & Record<string, unknown> = { ...data };
      const painted = paint?.nodes.get(node);
      if (!filtered.companyIds.has(node) || (!showIsolated && !connected.has(node) && node !== selectedId && !painted)) {
        res.hidden = true;
        return res as typeof data;
      }
      const c = data.company;
      const nodeLens = !paint && lensKind && lenses?.byId.get(node);
      res.color = paint
        ? painted?.color ?? tokens.viz.dimmed
        : nodeLens
        ? lensColor(lensKind, lensKind === 'risk' ? nodeLens.riskPct : nodeLens.opportunityPct, tokens)
        : colorBy === 'sector'
          ? sectorColor(c.sector, tokens)
          : colorBy === 'community'
            ? communityColor(metrics.byId.get(node)?.community ?? 99, tokens)
            : neutral;

      if (paint) {
        if (painted?.strong) {
          res.forceLabel = true;
          res.zIndex = 1;
        } else if (!painted) {
          res.label = '';
        }
      }
      if (focusId && focusNeighbors) {
        if (node === focusId) {
          res.highlighted = true;
          res.forceLabel = true;
          res.zIndex = 2;
        } else if (focusNeighbors.has(node)) {
          res.forceLabel = true;
          res.zIndex = 1;
        } else {
          res.color = tokens.viz.dimmed;
          res.label = '';
          res.zIndex = 0;
        }
      }
      if (!focusId && edgeEnds) {
        if (edgeEnds.includes(node)) {
          res.highlighted = true;
          res.forceLabel = true;
          res.zIndex = 2;
        } else {
          res.color = tokens.viz.dimmed;
          res.label = '';
        }
      }
      if (node === selectedId) res.highlighted = true;
      return res as typeof data;
    });

    sigma.setSetting('edgeReducer', (edge, data) => {
      const res: Partial<typeof data> & Record<string, unknown> = { ...data };
      const type = visibleEdges.get(edge);
      const [s, t] = graph.extremities(edge);
      if (!type || !filtered.companyIds.has(s) || !filtered.companyIds.has(t)) {
        res.hidden = true;
        return res as typeof data;
      }
      const byType = colorBy === 'relationship' && !lensKind && !paint;
      res.type = 'line';
      const bg = tokens.bg.canvas;
      const paintedEdge = paintEdges?.get(edge);
      res.color = paint
        ? paintedEdge
          ? flatten(paintedEdge, bg, 0.85)
          : flatten(tokens.viz.edge, bg, 0.4)
        : lensEdge(edge, false) ?? (byType ? flatten(relationshipColor(type, tokens), bg, 0.75) : flatten(tokens.viz.edge, bg));
      if (paintedEdge) {
        res.size = data.size + 0.8;
        res.zIndex = 1;
        res.type = data.directed ? 'arrow' : 'line';
      }

      if (edge === hoveredEdge) {
        res.color = lensEdge(edge, true) ?? (byType ? relationshipColor(type, tokens) : flatten(tokens.viz.edgeStrong, bg));
        res.size = data.size + 1.5;
        res.zIndex = 2;
      }
      if (!focusId && edgeEnds) {
        if (edge === selectedEdge) {
          res.color = lensEdge(edge, true) ?? (byType ? relationshipColor(type, tokens) : tokens.text.primary);
          res.size = data.size + 2;
          res.type = data.directed ? 'arrow' : 'line';
          res.zIndex = 2;
        } else {
          res.hidden = true;
        }
      }
      if (focusId) {
        if (s === focusId || t === focusId) {
          res.color = lensEdge(edge, true) ?? (byType ? relationshipColor(type, tokens) : flatten(tokens.viz.edgeStrong, bg));
          res.size = data.size + 0.6;
          res.type = data.directed ? 'arrow' : 'line';
          res.zIndex = 1;
        } else {
          res.hidden = true;
        }
      }
      return res as typeof data;
    });
    // setSetting() already triggers a full refresh (reducers + re-normalization).
  }, [sigma, graph, filtered, metrics, tokens, colorBy, lensKind, lenses, edgeLens, paint, paintEdges, showIsolated, connected, focusId, focusNeighbors, selectedId, selectedEdge, edgeEnds, hoveredEdge, visibleEdges]);

  // ---------- Theme & label settings ----------
  useEffect(() => {
    sigma.setSetting('defaultDrawNodeLabel', makeLabelRenderer(tokens));
    sigma.setSetting('defaultDrawNodeHover', makeHoverRenderer(tokens));
    sigma.setSetting('renderLabels', showLabels);
  }, [sigma, tokens, showLabels]);

  // ---------- Camera frames a selected relationship ----------
  useEffect(() => {
    if (!edgeEnds) return;
    // A synchronous refresh applies the latest reducers and normalizes positions,
    // so display data is in camera space before we read it.
    sigma.refresh();
    const [p, q] = edgeEnds.map((n) => sigma.getNodeDisplayData(n));
    if (!p || !q) return;
    const span = Math.hypot(p.x - q.x, p.y - q.y);
    sigma
      .getCamera()
      .animate(
        { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2, ratio: Math.min(1, Math.max(0.25, span * 1.8)) },
        { duration: 500, easing: 'cubicInOut' },
      );
  }, [edgeEnds, sigma, layoutTick]);

  // ---------- Camera follows selection ----------
  useEffect(() => {
    if (!selectedId || selectedEdge || !graph.hasNode(selectedId)) return;
    sigma.refresh();
    const d = sigma.getNodeDisplayData(selectedId);
    if (!d) return;
    const camera = sigma.getCamera();
    camera.animate({ x: d.x, y: d.y, ratio: Math.min(camera.ratio, 0.6) }, { duration: 500, easing: 'cubicInOut' });
  }, [selectedId, selectedEdge, sigma, graph, layoutTick]);

  return null;
}
