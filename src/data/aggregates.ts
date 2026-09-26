/**
 * Pure aggregation selectors feeding the Insights charts.
 * Each takes filtered data and returns chart-ready structures.
 */
import type { Company, Relationship, RelationshipType, Sector } from './schema';
import { RELATIONSHIP_TYPES, SECTORS } from './schema';
import type { NetworkMetrics } from './metrics';

export interface Kpis {
  companies: number;
  relationships: number;
  avgDegree: number;
  crossBorderShare: number;
  countries: number;
  mostCentral: Company | null;
  mostConnectedSector: { sector: Sector; avgDegree: number } | null;
}

export function computeKpis(companies: Company[], relationships: Relationship[], metrics: NetworkMetrics): Kpis {
  const byId = new Map(companies.map((c) => [c.id, c]));
  let crossBorder = 0;
  for (const r of relationships) {
    if (byId.get(r.source)?.hq.countryCode !== byId.get(r.target)?.hq.countryCode) crossBorder++;
  }
  let mostCentral: Company | null = null;
  let best = -1;
  for (const c of companies) {
    const b = metrics.byId.get(c.id)?.betweenness ?? 0;
    if (b > best) {
      best = b;
      mostCentral = c;
    }
  }
  const sectorDeg = new Map<Sector, { sum: number; n: number }>();
  for (const c of companies) {
    const s = sectorDeg.get(c.sector) ?? { sum: 0, n: 0 };
    s.sum += metrics.byId.get(c.id)?.degree ?? 0;
    s.n++;
    sectorDeg.set(c.sector, s);
  }
  const topSector = [...sectorDeg.entries()]
    .filter(([, v]) => v.n >= 3)
    .map(([sector, v]) => ({ sector, avgDegree: v.sum / v.n }))
    .sort((a, b) => b.avgDegree - a.avgDegree)[0];

  const degSum = [...metrics.byId.values()].reduce((a, m) => a + m.degree, 0);
  return {
    companies: companies.length,
    relationships: relationships.length,
    avgDegree: companies.length ? degSum / companies.length : 0,
    crossBorderShare: relationships.length ? crossBorder / relationships.length : 0,
    countries: new Set(companies.map((c) => c.hq.countryCode)).size,
    mostCentral: best > 0 ? mostCentral : null,
    mostConnectedSector: topSector ?? null,
  };
}

/** Symmetric sector × sector count matrix, in SECTORS order. */
export function sectorMatrix(companies: Company[], relationships: Relationship[]): number[][] {
  const idx = new Map(SECTORS.map((s, i) => [s, i]));
  const sectorOf = new Map(companies.map((c) => [c.id, idx.get(c.sector)!]));
  const m = SECTORS.map(() => SECTORS.map(() => 0));
  for (const r of relationships) {
    const a = sectorOf.get(r.source);
    const b = sectorOf.get(r.target);
    if (a == null || b == null) continue;
    m[a][b] += 1;
    if (a !== b) m[b][a] += 1;
  }
  return m;
}

export interface FlowNode {
  id: string;
  label: string;
  column: 0 | 1 | 2;
  sector: Sector;
  companyId?: string;
}
export interface FlowLink {
  source: string;
  target: string;
  value: number;
}
export interface Flow {
  nodes: FlowNode[];
  links: FlowLink[];
}

/** Sector → sector supply flows (supplier sector on the left, customer sector on the right). */
export function sectorSupplyFlow(companies: Company[], relationships: Relationship[]): Flow {
  const sectorOf = new Map(companies.map((c) => [c.id, c.sector]));
  const agg = new Map<string, number>();
  for (const r of relationships) {
    if (r.type !== 'supplier') continue;
    const a = sectorOf.get(r.source);
    const b = sectorOf.get(r.target);
    if (!a || !b) continue;
    const k = `${a}→${b}`;
    agg.set(k, (agg.get(k) ?? 0) + r.weight);
  }
  const nodes = new Map<string, FlowNode>();
  const links: FlowLink[] = [];
  for (const [k, value] of agg) {
    const [a, b] = k.split('→') as [Sector, Sector];
    const sId = `L:${a}`;
    const tId = `R:${b}`;
    if (!nodes.has(sId)) nodes.set(sId, { id: sId, label: a, column: 0, sector: a });
    if (!nodes.has(tId)) nodes.set(tId, { id: tId, label: b, column: 2, sector: b });
    links.push({ source: sId, target: tId, value });
  }
  return { nodes: [...nodes.values()], links };
}

/** Suppliers → company → customers for one company. */
export function companySupplyFlow(companyId: string, companies: Company[], relationships: Relationship[]): Flow {
  const byId = new Map(companies.map((c) => [c.id, c]));
  const focus = byId.get(companyId);
  if (!focus) return { nodes: [], links: [] };
  const nodes: FlowNode[] = [{ id: `C:${focus.id}`, label: focus.shortName, column: 1, sector: focus.sector, companyId: focus.id }];
  const links: FlowLink[] = [];
  for (const r of relationships) {
    if (r.type !== 'supplier') continue;
    if (r.target === companyId && byId.has(r.source)) {
      const c = byId.get(r.source)!;
      nodes.push({ id: `L:${c.id}`, label: c.shortName, column: 0, sector: c.sector, companyId: c.id });
      links.push({ source: `L:${c.id}`, target: `C:${focus.id}`, value: r.weight });
    } else if (r.source === companyId && byId.has(r.target)) {
      const c = byId.get(r.target)!;
      nodes.push({ id: `R:${c.id}`, label: c.shortName, column: 2, sector: c.sector, companyId: c.id });
      links.push({ source: `C:${focus.id}`, target: `R:${c.id}`, value: r.weight });
    }
  }
  return nodes.length > 1 ? { nodes, links } : { nodes: [], links: [] };
}

export interface RankedCompany {
  company: Company;
  value: number;
}

export function topBy(
  companies: Company[],
  metrics: NetworkMetrics,
  key: 'betweenness' | 'degree',
  n = 15,
): RankedCompany[] {
  return companies
    .map((company) => ({ company, value: metrics.byId.get(company.id)?.[key] ?? 0 }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value || b.company.marketCap - a.company.marketCap)
    .slice(0, n);
}

/** Histogram of unique-counterparty counts: [{ degree, count }]. */
export function degreeHistogram(metrics: NetworkMetrics): { degree: number; count: number }[] {
  const counts = new Map<number, number>();
  let max = 0;
  for (const m of metrics.byId.values()) {
    counts.set(m.degree, (counts.get(m.degree) ?? 0) + 1);
    max = Math.max(max, m.degree);
  }
  return Array.from({ length: max + 1 }, (_, degree) => ({ degree, count: counts.get(degree) ?? 0 }));
}

export function typeBreakdown(relationships: Relationship[]): { type: RelationshipType; count: number }[] {
  const counts = new Map<RelationshipType, number>();
  for (const r of relationships) counts.set(r.type, (counts.get(r.type) ?? 0) + 1);
  return RELATIONSHIP_TYPES.map((type) => ({ type, count: counts.get(type) ?? 0 })).filter((d) => d.count > 0);
}

export interface GeoLink {
  source: Company;
  target: Company;
  count: number;
  weight: number;
}

/** Cross-border company links for the world map (domestic links are omitted — they'd be dots). */
export function crossBorderLinks(companies: Company[], relationships: Relationship[]): GeoLink[] {
  const byId = new Map(companies.map((c) => [c.id, c]));
  const out = new Map<string, GeoLink>();
  for (const r of relationships) {
    const a = byId.get(r.source);
    const b = byId.get(r.target);
    if (!a || !b || a.hq.countryCode === b.hq.countryCode) continue;
    const k = a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`;
    const hit = out.get(k);
    if (hit) {
      hit.count++;
      hit.weight = Math.max(hit.weight, r.weight);
    } else out.set(k, { source: a, target: b, count: 1, weight: r.weight });
  }
  return [...out.values()];
}
