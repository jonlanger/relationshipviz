/**
 * Portfolio look-through: what a set of stocks and funds is actually exposed to.
 *
 * Positions are stocks (company ids) and funds (tickers), each with an amount. Funds are expanded
 * into their mapped holdings, so a portfolio of VOO + SMH + NVDA becomes one exposure per company.
 * The relationship map then shows exposure you don't hold directly: the suppliers and customers
 * your holdings depend on, and the jurisdictions those dependencies sit in.
 *
 * Educational look-through, not advice. Thresholds for warnings are named constants.
 */
import type { Company, Relationship, Sector } from './schema';
import type { Fund } from './funds';
import { countryRisk } from './countryRisk';
import { effectiveMateriality, type LensResult } from './lenses';

export interface Position {
  kind: 'stock' | 'fund';
  /** Company id for stocks, fund ticker for funds. */
  id: string;
  /** Any consistent unit (dollars, shares × price, or percent). Only proportions matter. */
  amount: number;
}

export const LIMITS = {
  /** One company above this share of the portfolio. */
  company: 0.1,
  /** One sector above this share. */
  sector: 0.35,
  /** Holdings that depend on one counterparty above this share. */
  dependency: 0.25,
  /** Two funds sharing more than this share of their holdings. */
  overlap: 0.5,
  /** Holdings with a material tie to a high-risk jurisdiction above this share. */
  jurisdiction: 0.2,
  /** Ties at or above this materiality count as a real dependency. */
  materialTie: 0.6,
} as const;

export interface ExposureRow {
  id: string;
  /** Share of the whole portfolio, 0–1. */
  weight: number;
  /** Where it comes from: 'direct' or a fund ticker, with the share each contributes. */
  via: { source: string; weight: number }[];
}

export interface DependencyRow {
  /** The counterparty depended on. */
  id: string;
  /** Share of the portfolio in holdings that depend on it, weighted by how much they depend. */
  exposure: number;
  /** Share of the portfolio in holdings with a material tie to it (unweighted). */
  reach: number;
  alsoHeld: boolean;
  holdings: { id: string; weight: number; materiality: number; role: 'supplier' | 'customer'; relId: string }[];
}

export interface Warning {
  kind: 'company' | 'sector' | 'dependency' | 'overlap' | 'jurisdiction' | 'coverage';
  severity: 'high' | 'medium' | 'info';
  message: string;
  /** Company, sector, fund or country the warning is about. */
  subject: string;
}

export interface PortfolioAnalysis {
  total: number;
  /** Share of the portfolio we could map to companies in the dataset. */
  mapped: number;
  companies: ExposureRow[];
  sectors: { sector: Sector; weight: number }[];
  countries: { code: string; weight: number }[];
  dependencies: DependencyRow[];
  /** Share of the portfolio in holdings with a material tie into each jurisdiction (HQ or supply chain). */
  jurisdictions: { code: string; weight: number; tier: string }[];
  overlaps: { a: string; b: string; shared: number }[];
  scores: { risk: number | null; opportunity: number | null };
  warnings: Warning[];
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export function analyzePortfolio(
  positions: Position[],
  companies: Company[],
  relationships: Relationship[],
  funds: Map<string, Fund>,
  lenses?: LensResult | null,
): PortfolioAnalysis {
  const byId = new Map(companies.map((c) => [c.id, c]));
  const valid = positions.filter((p) => p.amount > 0 && (p.kind === 'stock' ? byId.has(p.id) : funds.has(p.id)));
  const total = sum(valid.map((p) => p.amount));

  // ---- Look-through exposure ----
  const rows = new Map<string, ExposureRow>();
  const fundVectors = new Map<string, Map<string, number>>();
  let mapped = 0;
  for (const p of valid) {
    const share = total ? p.amount / total : 0;
    if (p.kind === 'stock') {
      addExposure(rows, p.id, share, 'direct');
      mapped += share;
      continue;
    }
    const f = funds.get(p.id)!;
    const vec = new Map<string, number>();
    for (const h of f.holdings) {
      if (!byId.has(h.id)) continue;
      addExposure(rows, h.id, share * h.weight, p.id);
      vec.set(h.id, h.weight);
      mapped += share * h.weight;
    }
    fundVectors.set(p.id, vec);
  }
  const exposure = new Map([...rows].map(([id, r]) => [id, r.weight]));
  const companiesOut = [...rows.values()].sort((a, b) => b.weight - a.weight);

  const bySector = new Map<Sector, number>();
  const byCountry = new Map<string, number>();
  for (const [id, w] of exposure) {
    const c = byId.get(id)!;
    bySector.set(c.sector, (bySector.get(c.sector) ?? 0) + w);
    byCountry.set(c.hq.countryCode, (byCountry.get(c.hq.countryCode) ?? 0) + w);
  }

  // ---- Hidden dependencies: suppliers and customers the holdings rely on ----
  const deps = new Map<string, DependencyRow>();
  const addDep = (cp: string, holding: string, w: number, m: number, role: 'supplier' | 'customer', relId: string) => {
    const d = deps.get(cp) ?? { id: cp, exposure: 0, reach: 0, alsoHeld: exposure.has(cp), holdings: [] };
    d.exposure += w * m;
    if (m >= LIMITS.materialTie) d.reach += w;
    d.holdings.push({ id: holding, weight: w, materiality: m, role, relId });
    deps.set(cp, d);
  };
  // Material ties into each jurisdiction (via HQ of the holding or of a counterparty).
  const juris = new Map<string, Set<string>>();
  const markJuris = (code: string, holding: string) => {
    const set = juris.get(code) ?? new Set();
    set.add(holding);
    juris.set(code, set);
  };
  for (const [id] of exposure) markJuris(byId.get(id)!.hq.countryCode, id);
  for (const r of relationships) {
    if (r.type !== 'supplier' || !byId.has(r.source) || !byId.has(r.target)) continue;
    const wt = exposure.get(r.target);
    if (wt) {
      const m = effectiveMateriality(r, r.target);
      addDep(r.source, r.target, wt, m, 'supplier', r.id);
      if (m >= LIMITS.materialTie) markJuris(byId.get(r.source)!.hq.countryCode, r.target);
    }
    const ws = exposure.get(r.source);
    if (ws) {
      const m = effectiveMateriality(r, r.source);
      addDep(r.target, r.source, ws, m, 'customer', r.id);
      if (m >= LIMITS.materialTie) markJuris(byId.get(r.target)!.hq.countryCode, r.source);
    }
  }
  for (const d of deps.values()) d.holdings.sort((a, b) => b.weight * b.materiality - a.weight * a.materiality);
  const dependencies = [...deps.values()].filter((d) => d.exposure > 0).sort((a, b) => b.exposure - a.exposure);
  const jurisdictions = [...juris]
    .map(([code, set]) => ({ code, weight: sum([...set].map((id) => exposure.get(id) ?? 0)), tier: countryRisk(code).tier }))
    .sort((a, b) => b.weight - a.weight);

  // ---- Fund overlap: Σ min(wA, wB) over shared holdings ----
  const overlaps: PortfolioAnalysis['overlaps'] = [];
  const fundIds = [...fundVectors.keys()];
  for (let i = 0; i < fundIds.length; i++) {
    for (let j = i + 1; j < fundIds.length; j++) {
      const a = fundVectors.get(fundIds[i])!;
      const b = fundVectors.get(fundIds[j])!;
      let shared = 0;
      for (const [id, w] of a) if (b.has(id)) shared += Math.min(w, b.get(id)!);
      overlaps.push({ a: fundIds[i], b: fundIds[j], shared });
    }
  }
  overlaps.sort((x, y) => y.shared - x.shared);

  // ---- Exposure-weighted lens scores ----
  const scores: PortfolioAnalysis['scores'] = { risk: null, opportunity: null };
  if (lenses) {
    let w = 0;
    let risk = 0;
    let opp = 0;
    for (const [id, x] of exposure) {
      const l = lenses.byId.get(id);
      if (!l) continue;
      w += x;
      risk += x * l.risk;
      opp += x * l.opportunity;
    }
    if (w > 0) {
      scores.risk = risk / w;
      scores.opportunity = opp / w;
    }
  }

  // ---- Warnings ----
  const name = (id: string) => byId.get(id)?.shortName ?? id;
  const pctText = (v: number) => `${Math.round(v * 100)}%`;
  const warnings: Warning[] = [];
  for (const r of companiesOut) {
    if (r.weight > LIMITS.company) {
      const funded = r.via.filter((v) => v.source !== 'direct').map((v) => v.source);
      warnings.push({
        kind: 'company',
        severity: r.weight > 2 * LIMITS.company ? 'high' : 'medium',
        subject: r.id,
        message: `${name(r.id)} is ${pctText(r.weight)} of the portfolio${funded.length ? `, including through ${funded.join(', ')}` : ''}.`,
      });
    }
  }
  for (const [sector, w] of bySector) {
    if (w > LIMITS.sector) warnings.push({ kind: 'sector', severity: 'medium', subject: sector, message: `${sector} is ${pctText(w)} of the portfolio.` });
  }
  for (const d of dependencies.slice(0, 5)) {
    if (d.reach > LIMITS.dependency) {
      warnings.push({
        kind: 'dependency',
        severity: d.reach > 2 * LIMITS.dependency ? 'high' : 'medium',
        subject: d.id,
        message: `${pctText(d.reach)} of the portfolio is in companies that depend heavily on ${name(d.id)}${d.alsoHeld ? ', which you also hold' : ''}.`,
      });
    }
  }
  for (const j of jurisdictions) {
    if (j.tier !== 'low' && j.weight > LIMITS.jurisdiction) {
      warnings.push({
        kind: 'jurisdiction',
        severity: j.tier === 'high' ? 'high' : 'medium',
        subject: j.code,
        message: `${pctText(j.weight)} of the portfolio is headquartered in or materially tied to ${countryName(j.code)} (${j.tier}-risk jurisdiction).`,
      });
    }
  }
  for (const o of overlaps) {
    if (o.shared > LIMITS.overlap) {
      warnings.push({ kind: 'overlap', severity: 'medium', subject: `${o.a}|${o.b}`, message: `${o.a} and ${o.b} share ${pctText(o.shared)} of their holdings, so they diversify each other less than it seems.` });
    }
  }
  if (total > 0 && mapped < 0.7) {
    warnings.push({
      kind: 'coverage',
      severity: 'info',
      subject: 'coverage',
      message: `Only ${pctText(mapped)} of the portfolio maps to companies in this dataset (S&P 500 plus key global partners). The rest isn't analyzed.`,
    });
  }
  const order = { high: 0, medium: 1, info: 2 };
  warnings.sort((a, b) => order[a.severity] - order[b.severity]);

  return {
    total,
    mapped,
    companies: companiesOut,
    sectors: [...bySector].map(([sector, weight]) => ({ sector, weight })).sort((a, b) => b.weight - a.weight),
    countries: [...byCountry].map(([code, weight]) => ({ code, weight })).sort((a, b) => b.weight - a.weight),
    dependencies,
    jurisdictions,
    overlaps,
    scores,
    warnings,
  };
}

function addExposure(rows: Map<string, ExposureRow>, id: string, w: number, source: string) {
  const r = rows.get(id) ?? { id, weight: 0, via: [] };
  r.weight += w;
  const v = r.via.find((x) => x.source === source);
  if (v) v.weight += w;
  else r.via.push({ source, weight: w });
  rows.set(id, r);
}

const COUNTRY_NAMES: Record<string, string> = {
  US: 'the United States', TW: 'Taiwan', KR: 'South Korea', CN: 'China', HK: 'Hong Kong', JP: 'Japan', NL: 'the Netherlands',
  DE: 'Germany', GB: 'the United Kingdom', IE: 'Ireland', DK: 'Denmark', CH: 'Switzerland', CA: 'Canada', BM: 'Bermuda', IL: 'Israel', RU: 'Russia',
};
export const countryName = (code: string) => COUNTRY_NAMES[code] ?? code;

/** Exposure map (company id → share) from an analysis, for scenario impact. */
export const exposureOf = (a: PortfolioAnalysis) => new Map(a.companies.map((r) => [r.id, r.weight]));
