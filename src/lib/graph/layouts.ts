import type { RelGraph } from '@/data/graph';
import { SECTORS, type Sector } from '@/data/schema';
import type { LayoutRequest, LayoutResponse } from './layout.worker';

export type Positions = Record<string, { x: number; y: number }>;

/** Run ForceAtlas2 in a Web Worker. Only the attributes the layout needs are sent. */
export function computeForceLayout(graph: RelGraph, iterations = 800): Promise<Positions> {
  const worker = new Worker(new URL('./layout.worker.ts', import.meta.url), { type: 'module' });
  const lean = {
    attributes: {},
    options: { type: 'undirected' as const, multi: false, allowSelfLoops: false },
    nodes: graph.mapNodes((key, a) => ({ key, attributes: { x: a.x, y: a.y, size: a.size } })),
    edges: graph.mapEdges((key, a, source, target) => ({ key, source, target, attributes: { weight: a.weight } })),
  };
  return new Promise((resolve, reject) => {
    worker.onmessage = (e: MessageEvent<LayoutResponse>) => {
      resolve(e.data);
      worker.terminate();
    };
    worker.onerror = (e) => {
      reject(e);
      worker.terminate();
    };
    worker.postMessage({ graph: lean, iterations } satisfies LayoutRequest);
  });
}

export interface SectorCluster {
  sector: Sector;
  x: number;
  y: number;
  radius: number;
}

/**
 * Deterministic "cluster by sector" layout: each sector is a phyllotaxis disc,
 * largest companies at the center; discs are arranged on a ring, sized by member count.
 */
export function computeSectorLayout(graph: RelGraph): { positions: Positions; clusters: SectorCluster[] } {
  const groups = new Map<Sector, { id: string; cap: number; size: number }[]>();
  graph.forEachNode((id, a) => {
    const list = groups.get(a.company.sector) ?? [];
    list.push({ id, cap: a.company.marketCap, size: a.size });
    groups.set(a.company.sector, list);
  });

  const present = SECTORS.filter((s) => groups.has(s));
  const GOLDEN = Math.PI * (3 - Math.sqrt(5));
  const SPACING = 11;
  const discRadius = (n: number) => SPACING * Math.sqrt(n) + 16;
  const ringCircumference = present.reduce((acc, s) => acc + discRadius(groups.get(s)!.length) * 2 + 24, 0);
  const ringR = Math.max(ringCircumference / (2 * Math.PI), 60);

  const positions: Positions = {};
  const clusters: SectorCluster[] = [];
  let angleCursor = -Math.PI / 2;
  for (const sector of present) {
    const members = groups.get(sector)!.sort((a, b) => b.cap - a.cap);
    const r = discRadius(members.length);
    const span = ((r * 2 + 24) / ringCircumference) * Math.PI * 2;
    const angle = angleCursor + span / 2;
    angleCursor += span;
    const cx = Math.cos(angle) * ringR;
    const cy = Math.sin(angle) * ringR;
    members.forEach((m, i) => {
      const rr = SPACING * Math.sqrt(i + 0.5);
      positions[m.id] = { x: cx + Math.cos(i * GOLDEN) * rr, y: cy + Math.sin(i * GOLDEN) * rr };
    });
    clusters.push({ sector, x: cx, y: cy, radius: r });
  }
  return { positions, clusters };
}
