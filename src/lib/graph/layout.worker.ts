/// <reference lib="webworker" />
/**
 * Force layout off the main thread: ForceAtlas2 from the sector-seeded positions,
 * then a no-overlap pass. Deterministic for a given input.
 */
import Graph from 'graphology';
import type { SerializedGraph } from 'graphology-types';
import forceAtlas2 from 'graphology-layout-forceatlas2';
import noverlap from 'graphology-layout-noverlap';

export interface LayoutRequest {
  graph: SerializedGraph;
  iterations: number;
}
export type LayoutResponse = Record<string, { x: number; y: number }>;

self.onmessage = (e: MessageEvent<LayoutRequest>) => {
  const graph = Graph.from(e.data.graph);
  const settings = forceAtlas2.inferSettings(graph);
  forceAtlas2.assign(graph, {
    iterations: e.data.iterations,
    getEdgeWeight: 'weight',
    settings: {
      ...settings,
      gravity: 0.05,
      scalingRatio: 40,
      strongGravityMode: true,
      linLogMode: false,
      outboundAttractionDistribution: false,
      edgeWeightInfluence: 1,
      slowDown: 2,
      adjustSizes: false,
      barnesHutOptimize: graph.order > 400,
    },
  });
  noverlap.assign(graph, { maxIterations: 200, settings: { margin: 2, ratio: 1.1 } });
  const out: LayoutResponse = {};
  graph.forEachNode((n, a) => {
    out[n] = { x: a.x, y: a.y };
  });
  (self as unknown as Worker).postMessage(out);
};
