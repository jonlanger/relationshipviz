/**
 * Scenario shocks: "what if X is disrupted?" traced through the relationship network.
 *
 * A shock hits a set of companies (named directly, or everyone in a country or sector) with a
 * severity from 0 to 1. Impact then flows along relationships for up to MAX_HOPS hops:
 *
 *  - disruption: the shocked companies can't deliver. Their customers lose supply (weighted by
 *    how much each customer depends on them) and their suppliers lose a customer.
 *  - demand:     the shocked companies cut spending. Only their suppliers are hit, weighted by
 *    how much of each supplier's business they are.
 *
 * Partners, owners and investors feel a smaller share. Competitors of directly shocked companies
 * are listed separately as possible beneficiaries. Each company keeps its strongest path, so
 * every number can be explained ("Apple ← TSMC, supplier").
 *
 * Deliberately simple and transparent: no market-price model, no feedback loops.
 */
import type { Company, Relationship, Sector } from './schema';
import { effectiveMateriality } from './lenses';

export type ShockTarget =
  | { kind: 'company'; ids: string[] }
  | { kind: 'country'; code: string }
  | { kind: 'sector'; sector: Sector };

export type ShockMode = 'disruption' | 'demand';

export interface Shock {
  target: ShockTarget;
  mode: ShockMode;
  /** 0–1. */
  severity: number;
}

export interface PathStep {
  from: string;
  to: string;
  relId: string;
  /** Plain-language role of the link, from the impacted company's side: "supplier", "customer", … */
  role: string;
}

export interface Impact {
  id: string;
  /** 0–1: share of the shock that reaches this company along its strongest path. */
  impact: number;
  /** 0 for shocked companies, else the number of links from the nearest shocked one. */
  hop: number;
  /** Strongest path from a shocked company to this one (empty for shocked companies). */
  path: PathStep[];
}

export interface Beneficiary {
  id: string;
  /** 0–1, relative. */
  gain: number;
  /** The shocked competitor. */
  via: string;
  relId: string;
}

export interface ScenarioResult {
  shocked: string[];
  impacts: Map<string, Impact>;
  beneficiaries: Beneficiary[];
}

export const MAX_HOPS = 3;
/** Applied from the second hop on: direct dependants feel the shock in full proportion. */
export const DAMPING = 0.5;
/** Impacts below this are dropped as noise. */
export const MIN_IMPACT = 0.02;

export function shockedIds(target: ShockTarget, companies: Company[]): string[] {
  switch (target.kind) {
    case 'company':
      return target.ids.filter((id) => companies.some((c) => c.id === id));
    case 'country':
      return companies.filter((c) => c.hq.countryCode === target.code).map((c) => c.id);
    case 'sector':
      return companies.filter((c) => c.sector === target.sector).map((c) => c.id);
  }
}

interface Edge {
  to: string;
  rel: Relationship;
  /** Share of the upstream impact that passes to `to`. */
  factor: number;
  role: string;
}

export function runScenario(shock: Shock, companies: Company[], relationships: Relationship[]): ScenarioResult {
  const known = new Set(companies.map((c) => c.id));
  const shocked = shockedIds(shock.target, companies);
  const severity = Math.min(1, Math.max(0, shock.severity));

  // Outgoing propagation edges per company, computed once.
  const edges = new Map<string, Edge[]>();
  const add = (from: string, e: Edge) => {
    if (e.factor <= 0) return;
    const list = edges.get(from) ?? [];
    list.push(e);
    edges.set(from, list);
  };
  for (const r of relationships) {
    if (!known.has(r.source) || !known.has(r.target)) continue;
    const s = r.source;
    const t = r.target;
    switch (r.type) {
      case 'supplier':
        // Supplier hit → customer loses supply (disruption only).
        if (shock.mode === 'disruption') add(s, { to: t, rel: r, factor: effectiveMateriality(r, t), role: 'supplier' });
        // Customer hit → supplier loses sales.
        add(t, { to: s, rel: r, factor: effectiveMateriality(r, s), role: 'customer' });
        break;
      case 'partner':
        add(s, { to: t, rel: r, factor: 0.3 * r.weight, role: 'partner' });
        add(t, { to: s, rel: r, factor: 0.3 * r.weight, role: 'partner' });
        break;
      case 'investor':
        // Investee hit → investor's stake loses value; investor hit → investee loses a backer.
        add(t, { to: s, rel: r, factor: 0.3 * r.weight, role: 'investee' });
        add(s, { to: t, rel: r, factor: 0.2 * r.weight, role: 'investor' });
        break;
      case 'subsidiary':
        // source is owned by target.
        add(t, { to: s, rel: r, factor: 0.8 * r.weight, role: 'parent' });
        add(s, { to: t, rel: r, factor: 0.5 * r.weight, role: 'subsidiary' });
        break;
      case 'competitor':
        break;
    }
  }

  const impacts = new Map<string, Impact>();
  for (const id of shocked) impacts.set(id, { id, impact: severity, hop: 0, path: [] });

  let frontier = [...shocked];
  for (let hop = 1; hop <= MAX_HOPS && frontier.length; hop++) {
    const damp = hop === 1 ? 1 : DAMPING;
    const next = new Set<string>();
    for (const from of frontier) {
      const src = impacts.get(from)!;
      for (const e of edges.get(from) ?? []) {
        const v = src.impact * e.factor * damp;
        if (v < MIN_IMPACT) continue;
        const prev = impacts.get(e.to);
        if (prev && prev.impact >= v) continue;
        impacts.set(e.to, { id: e.to, impact: v, hop, path: [...src.path, { from, to: e.to, relId: e.rel.id, role: e.role }] });
        next.add(e.to);
      }
    }
    frontier = [...next];
  }

  // Competitors of directly shocked companies may pick up share.
  const shockedSet = new Set(shocked);
  const gains = new Map<string, Beneficiary>();
  for (const r of relationships) {
    if (r.type !== 'competitor') continue;
    for (const [a, b] of [[r.source, r.target], [r.target, r.source]] as const) {
      if (!shockedSet.has(a) || shockedSet.has(b) || !known.has(b)) continue;
      const gain = severity * r.weight * 0.5;
      if ((gains.get(b)?.gain ?? 0) < gain) gains.set(b, { id: b, gain, via: a, relId: r.id });
    }
  }

  return {
    shocked,
    impacts,
    beneficiaries: [...gains.values()].filter((g) => (impacts.get(g.id)?.impact ?? 0) < g.gain).sort((x, y) => y.gain - x.gain),
  };
}

/** Portfolio-level impact: exposure-weighted sum of company impacts, 0–1. */
export function exposureImpact(result: ScenarioResult, exposure: Map<string, number>): number {
  let total = 0;
  for (const [id, w] of exposure) total += w * (result.impacts.get(id)?.impact ?? 0);
  return total;
}
