import Graph from 'graphology';
import type { Company, Dataset, Relationship, RelationshipType } from './schema';
import { SECTORS, SYMMETRIC_TYPES } from './schema';

export interface NodeAttrs {
  label: string;
  company: Company;
  x: number;
  y: number;
  size: number;
  color: string;
}

export interface EdgeAttrs {
  /** All relationships between this pair, strongest first. */
  relationships: Relationship[];
  primaryType: RelationshipType;
  types: RelationshipType[];
  weight: number;
  confidence: number;
  /** True when the primary relationship has a direction (supplier, investor, subsidiary). */
  directed: boolean;
  size: number;
  color: string;
  type: 'arrow' | 'line';
}

export type RelGraph = Graph<NodeAttrs, EdgeAttrs>;

export const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/** Node radius from market cap — sqrt so area, not radius, tracks value. */
export function nodeSize(marketCapB: number, maxCapB: number): number {
  const MIN = 3;
  const MAX = 22;
  return MIN + (MAX - MIN) * Math.sqrt(Math.max(marketCapB, 0) / maxCapB);
}

/**
 * Deterministic seed positions: each sector gets a wedge on a ring, companies are placed
 * inside by size. ForceAtlas2 then refines from here, so layouts are stable across loads.
 */
export function sectorSeedPosition(company: Company, indexInSector: number, sectorCount: number) {
  const s = SECTORS.indexOf(company.sector);
  const angle = (s / SECTORS.length) * Math.PI * 2;
  const r = 100 + (indexInSector % 6) * 14;
  const spread = ((indexInSector / Math.max(sectorCount, 1)) - 0.5) * (Math.PI * 2 / SECTORS.length) * 0.9;
  return { x: Math.cos(angle + spread) * r, y: Math.sin(angle + spread) * r };
}

/** Undirected graph with one edge per company pair; per-relationship direction is kept in attrs. */
export function buildGraph(dataset: Dataset): RelGraph {
  const graph: RelGraph = new Graph<NodeAttrs, EdgeAttrs>({ type: 'undirected', multi: false });
  const maxCap = Math.max(...dataset.companies.map((c) => c.marketCap), 1);

  const bySector = new Map<string, Company[]>();
  for (const c of dataset.companies) {
    const list = bySector.get(c.sector) ?? [];
    list.push(c);
    bySector.set(c.sector, list);
  }
  for (const list of bySector.values()) list.sort((a, b) => b.marketCap - a.marketCap);

  for (const c of dataset.companies) {
    const list = bySector.get(c.sector)!;
    const pos = sectorSeedPosition(c, list.indexOf(c), list.length);
    graph.addNode(c.id, {
      label: c.shortName,
      company: c,
      ...pos,
      size: nodeSize(c.marketCap, maxCap),
      color: '#888',
    });
  }

  const pairs = new Map<string, Relationship[]>();
  for (const r of dataset.relationships) {
    const k = pairKey(r.source, r.target);
    const list = pairs.get(k) ?? [];
    list.push(r);
    pairs.set(k, list);
  }

  for (const [key, rels] of pairs) {
    rels.sort((a, b) => b.weight - a.weight);
    const primary = rels[0];
    const directed = !SYMMETRIC_TYPES.has(primary.type);
    graph.addEdgeWithKey(key, primary.source, primary.target, {
      relationships: rels,
      primaryType: primary.type,
      types: [...new Set(rels.map((r) => r.type))],
      weight: Math.max(...rels.map((r) => r.weight)),
      confidence: Math.max(...rels.map((r) => r.confidence)),
      directed,
      size: 0.6 + primary.weight * 2.4,
      color: '#888',
      type: directed ? 'arrow' : 'line',
    });
  }
  return graph;
}
