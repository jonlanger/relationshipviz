import Graph from 'graphology';
import betweenness from 'graphology-metrics/centrality/betweenness';
import louvain from 'graphology-communities-louvain';
import type { Company, Relationship } from './schema';
import { pairKey } from './graph';

export interface NodeMetrics {
  /** Unique counterparties. */
  degree: number;
  /** Count of relationships where this company supplies/invests (outgoing direction). */
  outgoing: number;
  /** Count of relationships where this company is supplied/backed. */
  incoming: number;
  /** Normalized betweenness centrality, 0–1: how often the company bridges others. */
  betweenness: number;
  /** Louvain community index, ranked by community size (0 = largest). */
  community: number;
}

export interface NetworkMetrics {
  byId: Map<string, NodeMetrics>;
  communityCount: number;
  communitySizes: number[];
  density: number;
}

/** Tiny deterministic PRNG so community detection is stable across renders. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function computeMetrics(companies: Company[], relationships: Relationship[]): NetworkMetrics {
  const g = new Graph({ type: 'undirected' });
  for (const c of companies) g.addNode(c.id);
  const incoming = new Map<string, number>();
  const outgoing = new Map<string, number>();
  for (const r of relationships) {
    if (!g.hasNode(r.source) || !g.hasNode(r.target)) continue;
    const k = pairKey(r.source, r.target);
    if (!g.hasEdge(k)) g.addEdgeWithKey(k, r.source, r.target, { weight: r.weight });
    else g.updateEdgeAttribute(k, 'weight', (w: number) => Math.max(w, r.weight));
    if (r.type !== 'competitor' && r.type !== 'partner') {
      outgoing.set(r.source, (outgoing.get(r.source) ?? 0) + 1);
      incoming.set(r.target, (incoming.get(r.target) ?? 0) + 1);
    }
  }

  const bc = g.size > 0 ? betweenness(g, { normalized: true }) : {};
  const communities: Record<string, number> =
    g.size > 0 ? louvain(g, { getEdgeWeight: 'weight', rng: mulberry32(42) }) : {};

  // Rank communities by size so color slots go to the largest groups.
  const sizes = new Map<number, number>();
  for (const c of Object.values(communities)) sizes.set(c, (sizes.get(c) ?? 0) + 1);
  const ranked = [...sizes.entries()].sort((a, b) => b[1] - a[1]);
  const rankOf = new Map(ranked.map(([c], i) => [c, i]));

  const byId = new Map<string, NodeMetrics>();
  g.forEachNode((id) => {
    byId.set(id, {
      degree: g.degree(id),
      outgoing: outgoing.get(id) ?? 0,
      incoming: incoming.get(id) ?? 0,
      betweenness: bc[id] ?? 0,
      community: communities[id] != null ? rankOf.get(communities[id])! : -1,
    });
  });

  const n = g.order;
  return {
    byId,
    communityCount: ranked.length,
    communitySizes: ranked.map(([, s]) => s),
    density: n > 1 ? (2 * g.size) / (n * (n - 1)) : 0,
  };
}
