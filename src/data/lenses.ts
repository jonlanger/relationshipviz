/**
 * Risk & Opportunity lenses: transparent, rule-based scores for an equity holder.
 *
 * Risk        = how exposed a company is *through* its relationships.
 * Opportunity = how well its relationships position it to benefit.
 *
 * Each factor produces a raw value per company, which is turned into a percentile across
 * the companies passed in (so scores are relative to the visible universe). A company's
 * score is the weighted mean of its factor percentiles. A factor with no data (or that doesn't
 * apply, e.g. customer concentration for a company with no mapped customers) counts as the
 * median, and `coverage` records how much of the weight had real data.
 * Every factor also attributes its value to the relationships behind it ("drivers").
 *
 * Signals, not advice.
 */
import type { Company, Relationship } from './schema';
import type { NetworkMetrics } from './metrics';
import { countryRisk } from './countryRisk';

// ---------------------------------------------------------------------------
// Factor catalog
// ---------------------------------------------------------------------------

export const RISK_FACTORS = [
  'supplierConcentration',
  'customerConcentration',
  'geoExposure',
  'counterpartyFragility',
  'competitivePressure',
  'relationshipInstability',
  'fundamentals',
] as const;
export type RiskFactorKey = (typeof RISK_FACTORS)[number];

export const OPPORTUNITY_FACTORS = [
  'demandPull',
  'chokepoint',
  'ecosystemMomentum',
  'relativeMomentum',
  'growthQuality',
  'newDeals',
] as const;
export type OpportunityFactorKey = (typeof OPPORTUNITY_FACTORS)[number];

export type FactorKey = RiskFactorKey | OpportunityFactorKey;
export type LensKind = 'risk' | 'opportunity';

export const FACTOR_META: Record<FactorKey, { label: string; description: string }> = {
  supplierConcentration: {
    label: 'Supplier concentration',
    description: 'Relies on few suppliers, or one supplier it can’t easily replace.',
  },
  customerConcentration: {
    label: 'Customer concentration',
    description: 'A large share of business goes to a few customers.',
  },
  geoExposure: {
    label: 'Geographic exposure',
    description: 'Headquartered in, or depends on counterparties in, higher-risk jurisdictions.',
  },
  counterpartyFragility: {
    label: 'Counterparty fragility',
    description: 'Suppliers, customers and partners with shrinking revenue or weak margins.',
  },
  competitivePressure: {
    label: 'Competitive pressure',
    description: 'Competitors are growing faster than the company.',
  },
  relationshipInstability: {
    label: 'Relationship instability',
    description: 'Ties that are ended, disputed or thinly evidenced.',
  },
  fundamentals: {
    label: 'Weak fundamentals',
    description: 'The company’s own revenue and margin trend (SEC filings).',
  },
  demandPull: {
    label: 'Demand pull',
    description: 'Its customers are growing, pulling demand through.',
  },
  chokepoint: {
    label: 'Chokepoint position',
    description: 'Bridges the network and is a critical supplier to many (pricing power).',
  },
  ecosystemMomentum: {
    label: 'Ecosystem momentum',
    description: 'Partners and investees are growing; large deals in place.',
  },
  relativeMomentum: {
    label: 'Relative momentum',
    description: 'Growing faster than its competitors.',
  },
  growthQuality: {
    label: 'Growth quality',
    description: 'Revenue growth, margin trend and R&D intensity.',
  },
  newDeals: {
    label: 'New deals',
    description: 'Recently announced or started relationships and deal events.',
  },
};

export interface LensWeights {
  risk: Record<RiskFactorKey, number>;
  opportunity: Record<OpportunityFactorKey, number>;
}

export const DEFAULT_LENS_WEIGHTS: LensWeights = {
  risk: {
    supplierConcentration: 1,
    customerConcentration: 1,
    geoExposure: 1,
    counterpartyFragility: 0.75,
    competitivePressure: 0.75,
    relationshipInstability: 0.25,
    fundamentals: 0.5,
  },
  opportunity: {
    demandPull: 1,
    chokepoint: 1,
    ecosystemMomentum: 0.75,
    relativeMomentum: 0.75,
    growthQuality: 0.75,
    newDeals: 0.25,
  },
};

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export interface Driver {
  relId: string;
  counterpartyId: string;
  /** Share of the company's lens score attributable to this relationship, 0–1. */
  contribution: number;
  factor: FactorKey;
  reason: string;
}

export interface Factor {
  key: FactorKey;
  label: string;
  /** Raw value before normalization; null when the input data is missing. */
  raw: number | null;
  /** Percentile across the universe, 0–1; null when missing. */
  score: number | null;
  /** Weight as configured. */
  weight: number;
  /** Points this factor adds to the 0–100 score. */
  contribution: number;
  explain: string;
}

export type Stance = 'add' | 'watch' | 'reduce' | 'hold';

export const STANCE_META: Record<Stance, { label: string; description: string }> = {
  add: { label: 'Upside, lower risk', description: 'Above-median opportunity with below-median risk.' },
  watch: { label: 'Upside, higher risk', description: 'Above-median opportunity, but above-median exposure too.' },
  reduce: { label: 'Higher risk, less upside', description: 'Above-median exposure without offsetting opportunity.' },
  hold: { label: 'Low signal', description: 'Below-median on both: little signal either way.' },
};

export interface CompanyLens {
  /** 0–100 weighted mean of factor percentiles. */
  risk: number;
  opportunity: number;
  /** Percentile of the score among the universe, 0–1. Drives colors and the stance split. */
  riskPct: number;
  opportunityPct: number;
  stance: Stance;
  /** Share of configured weight that had data, 0–1. */
  riskCoverage: number;
  opportunityCoverage: number;
  riskFactors: Factor[];
  opportunityFactors: Factor[];
  riskDrivers: Driver[];
  opportunityDrivers: Driver[];
}

export interface RelLens {
  relId: string;
  /** 0–1 relative to the strongest link in the universe. */
  risk: number;
  opportunity: number;
  /** The company whose score this link moves most, and why. */
  riskFor: string | null;
  riskReason: string | null;
  opportunityFor: string | null;
  opportunityReason: string | null;
}

export interface LensResult {
  byId: Map<string, CompanyLens>;
  byRel: Map<string, RelLens>;
  /** Count of supplier links strong enough to be single-source (weight ≥ SINGLE_SOURCE). */
  singleSourceCount: number;
}

export const SINGLE_SOURCE = 0.8;
/** Weakness at or above this names a counterparty as financially weak. */
export const WEAK_COUNTERPARTY = 0.15;
/** Percentile assumed for a factor with no data: the median, i.e. no evidence either way. */
export const MISSING_SCORE = 0.5;
/** Coverage below this shows a "limited data" note. */
export const LOW_COVERAGE = 0.5;

// ---------------------------------------------------------------------------
// Financial helpers (ratios, so currency doesn't matter)
// ---------------------------------------------------------------------------

const revenueYears = (c: Company) =>
  (c.financials?.annual ?? []).filter((y) => y.revenue != null && y.revenue > 0).sort((a, b) => a.fiscalYear - b.fiscalYear);

/** Compound annual revenue growth over the last `years` fiscal years (fewer if that's all there is). */
export function revenueCagr(c: Company, years = 3): number | null {
  const s = revenueYears(c);
  if (s.length < 2) return null;
  const last = s[s.length - 1];
  const base = s[Math.max(0, s.length - 1 - years)];
  const n = last.fiscalYear - base.fiscalYear;
  if (n <= 0) return null;
  return (last.revenue! / base.revenue!) ** (1 / n) - 1;
}

export function netMargin(c: Company): number | null {
  const s = revenueYears(c).filter((y) => y.netIncome != null);
  const last = s[s.length - 1];
  return last ? last.netIncome! / last.revenue! : null;
}

/** Change in net margin over the last `years` fiscal years, in margin points (0.05 = +5pp). */
export function marginTrend(c: Company, years = 3): number | null {
  const s = revenueYears(c).filter((y) => y.netIncome != null);
  if (s.length < 2) return null;
  const last = s[s.length - 1];
  const base = s[Math.max(0, s.length - 1 - years)];
  return last.netIncome! / last.revenue! - base.netIncome! / base.revenue!;
}

export function rndIntensity(c: Company): number | null {
  const s = revenueYears(c).filter((y) => y.rnd != null);
  const last = s[s.length - 1];
  return last ? last.rnd! / last.revenue! : null;
}

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

/** Financial weakness on an absolute scale, 0–1: shrinking revenue, losses, falling margins. */
export function weakness(c: Company): number | null {
  const g = revenueCagr(c);
  const m = netMargin(c);
  if (g == null && m == null) return null;
  const shrink = g == null ? 0 : clamp(-g / 0.15);
  const loss = m == null ? 0 : clamp(-m / 0.15);
  const t = marginTrend(c);
  const decline = t == null ? 0 : clamp(-t / 0.1);
  return clamp(0.45 * shrink + 0.35 * loss + 0.2 * decline);
}

/**
 * How material a tie is to `perspective`, 0–1. The link's strength, raised by a disclosed revenue
 * share when that share is of `perspective`'s own revenue (25%+ of revenue counts as fully material).
 * A share is one-sided: Nvidia being 19% of TSMC's revenue says nothing about Nvidia's dependence.
 */
export function effectiveMateriality(r: Relationship, perspective: string): number {
  const share = r.detail?.materiality?.revenueShare;
  return share && share.of === perspective ? Math.max(r.weight, clamp(share.value / 0.25)) : r.weight;
}

/** Herfindahl index of a set of weights, 0–1 (1 = all weight on one). */
export function hhi(weights: number[]): number {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) return 0;
  return weights.reduce((a, w) => a + (w / sum) ** 2, 0);
}

/**
 * Percentile rank: the share of other values strictly below this one. Ties share the lower
 * rank, so a factor that's zero for most companies scores zero for all of them.
 */
export function percentiles(values: Map<string, number | null>): Map<string, number | null> {
  const present = [...values.values()].filter((v): v is number => v != null).sort((a, b) => a - b);
  const out = new Map<string, number | null>();
  const n = present.length;
  for (const [id, v] of values) {
    if (v == null) {
      out.set(id, null);
      continue;
    }
    if (n <= 1) {
      out.set(id, v > 0 ? 1 : 0);
      continue;
    }
    // First index with value >= v.
    let lo = 0;
    let hi = n;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (present[mid] < v) lo = mid + 1;
      else hi = mid;
    }
    out.set(id, lo / (n - 1));
  }
  return out;
}

const pct = (v: number) => `${Math.round(v * 100)}%`;
const signedPct = (v: number) => `${v >= 0 ? '+' : ''}${Math.round(v * 100)}%`;
const fmtGrowth = (g: number | null | undefined) => (g == null ? 'n/a' : `${signedPct(g)}/yr`);
const fmtMargin = (m: number | null) => (m == null ? 'n/a' : pct(m));

/** Year and month from "2025", "2025-10", "2025-10-28", "2025-Q2". */
function eventTime(d: string): number | null {
  const m = d.match(/^(\d{4})(?:-(Q)?(\d{1,2}))?/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = m[3] ? (m[2] ? (Number(m[3]) - 1) * 3 + 2 : Number(m[3]) - 1) : 6;
  return year * 12 + month;
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

interface RawFactor {
  raw: number | null;
  explain: string;
  /** Per-relationship attribution; values are relative within the factor. */
  drivers: { rel: Relationship; counterpartyId: string; value: number; reason: string }[];
}

interface Ties {
  suppliers: Relationship[];
  customers: Relationship[];
  competitors: Relationship[];
  partners: Relationship[];
  investees: Relationship[];
  all: Relationship[];
}

export interface LensOptions {
  /** Reference date for "recent" deal events, YYYY-MM. Defaults to today. */
  asOf?: string;
}

export function computeLenses(
  companies: Company[],
  relationships: Relationship[],
  metrics: NetworkMetrics,
  weights: LensWeights = DEFAULT_LENS_WEIGHTS,
  options: LensOptions = {},
): LensResult {
  const byCompany = new Map(companies.map((c) => [c.id, c]));
  const name = (id: string) => byCompany.get(id)?.shortName ?? id;
  const other = (r: Relationship, id: string) => (r.source === id ? r.target : r.source);
  const now = eventTime(options.asOf ?? new Date().toISOString().slice(0, 7))!;

  const ties = new Map<string, Ties>();
  for (const c of companies) ties.set(c.id, { suppliers: [], customers: [], competitors: [], partners: [], investees: [], all: [] });
  for (const r of relationships) {
    const s = ties.get(r.source);
    const t = ties.get(r.target);
    if (!s || !t) continue;
    s.all.push(r);
    t.all.push(r);
    if (r.type === 'supplier') {
      s.customers.push(r);
      t.suppliers.push(r);
    } else if (r.type === 'competitor') {
      s.competitors.push(r);
      t.competitors.push(r);
    } else if (r.type === 'partner') {
      s.partners.push(r);
      t.partners.push(r);
    } else if (r.type === 'investor') {
      s.investees.push(r);
    }
  }

  const growth = new Map(companies.map((c) => [c.id, revenueCagr(c)]));
  const weak = new Map(companies.map((c) => [c.id, weakness(c)]));

  // ----- Risk factors -----
  const riskRaw: Record<RiskFactorKey, (c: Company, t: Ties) => RawFactor> = {
    supplierConcentration: (c, t) => {
      // No mapped suppliers means the factor doesn't apply, not that there's no dependence.
      if (!t.suppliers.length) return { raw: null, explain: 'No recorded suppliers.', drivers: [] };
      const w = t.suppliers.map((r) => effectiveMateriality(r, c.id));
      const top = t.suppliers[w.indexOf(Math.max(...w))];
      const max = Math.max(...w);
      const single = t.suppliers.filter((r) => r.weight >= SINGLE_SOURCE);
      return {
        raw: max * (0.5 + 0.5 * hhi(w)),
        explain:
          single.length > 0
            ? `Critical dependence on ${single.map((r) => name(r.source)).join(', ')} (${t.suppliers.length} supplier${t.suppliers.length === 1 ? '' : 's'} in total).`
            : `Largest supplier is ${name(top.source)} (strength ${max.toFixed(2)}) across ${t.suppliers.length} supplier${t.suppliers.length === 1 ? '' : 's'}.`,
        drivers: t.suppliers.map((r, i) => ({
          rel: r,
          counterpartyId: r.source,
          value: w[i] ** 2,
          reason: r.weight >= SINGLE_SOURCE ? `Near single-source supplier` : `Supplier dependence`,
        })),
      };
    },
    customerConcentration: (c, t) => {
      if (!t.customers.length) return { raw: null, explain: 'No recorded customers.', drivers: [] };
      const m = t.customers.map((r) => effectiveMateriality(r, c.id));
      const max = Math.max(...m);
      const top = t.customers[m.indexOf(max)];
      const share = top.detail?.materiality?.revenueShare;
      const disclosed = share?.of === c.id ? share : null;
      return {
        raw: max * (0.5 + 0.5 * hhi(m)),
        explain: disclosed
          ? `${name(top.target)} is about ${pct(disclosed.value)} of revenue (${disclosed.basis.toLowerCase()}).`
          : `Largest customer tie is ${name(top.target)} (strength ${max.toFixed(2)}) across ${t.customers.length} customer${t.customers.length === 1 ? '' : 's'}.`,
        drivers: t.customers.map((r, i) => ({
          rel: r,
          counterpartyId: r.target,
          value: m[i] ** 2,
          reason: r.detail?.materiality?.revenueShare?.of === c.id ? `Large disclosed revenue share` : `Customer concentration`,
        })),
      };
    },
    geoExposure: (c, t) => {
      const own = countryRisk(c.hq.countryCode);
      const chain = [...t.suppliers, ...t.customers];
      const exposures = chain.map((r) => {
        const cp = byCompany.get(other(r, c.id))!;
        return { r, cp, v: effectiveMateriality(r, c.id) * countryRisk(cp.hq.countryCode).score };
      });
      const worst = exposures.reduce((a, e) => (e.v > (a?.v ?? -1) ? e : a), null as (typeof exposures)[number] | null);
      const cpScore = worst?.v ?? 0;
      const raw = Math.max(own.score, cpScore);
      const worstRisk = worst ? countryRisk(worst.cp.hq.countryCode) : null;
      const explain =
        own.tier !== 'low' && own.score >= cpScore
          ? `Headquartered in ${c.hq.country}: ${own.note.toLowerCase()}.`
          : worst && worstRisk && worstRisk.tier !== 'low'
            ? `Depends on ${worst.cp.shortName} in ${worst.cp.hq.country}: ${worstRisk.note.toLowerCase()}.`
            : 'Home market and key counterparties are in lower-risk jurisdictions.';
      return {
        raw,
        explain,
        drivers: exposures
          .filter((e) => countryRisk(e.cp.hq.countryCode).tier !== 'low')
          .map((e) => ({ rel: e.r, counterpartyId: e.cp.id, value: e.v, reason: `Counterparty in ${e.cp.hq.country}` })),
      };
    },
    counterpartyFragility: (c, t) => {
      const cps = [...t.suppliers, ...t.customers, ...t.partners]
        .map((r) => ({ r, id: other(r, c.id), m: effectiveMateriality(r, c.id) }))
        .filter((x) => weak.get(x.id) != null);
      if (!cps.length) return { raw: null, explain: 'No financial data for its counterparties.', drivers: [] };
      const total = cps.reduce((a, x) => a + x.m, 0);
      const raw = cps.reduce((a, x) => a + x.m * weak.get(x.id)!, 0) / total;
      const worst = [...cps].sort((a, b) => b.m * weak.get(b.id)! - a.m * weak.get(a.id)!)[0];
      const worstWeak = weak.get(worst.id)!;
      return {
        raw,
        explain:
          worstWeak >= WEAK_COUNTERPARTY
            ? `Weakest material counterparty is ${name(worst.id)}: revenue ${fmtGrowth(growth.get(worst.id))}, net margin ${fmtMargin(netMargin(byCompany.get(worst.id)!))}.`
            : 'Key counterparties are financially healthy.',
        // Only counterparties that are actually weak get named; small blemishes still count in the score.
        drivers: cps
          .filter((x) => weak.get(x.id)! >= WEAK_COUNTERPARTY)
          .map((x) => ({ rel: x.r, counterpartyId: x.id, value: x.m * weak.get(x.id)!, reason: 'Financially weak counterparty' })),
      };
    },
    competitivePressure: (c, t) => {
      const own = growth.get(c.id);
      if (own == null) return { raw: null, explain: 'No revenue history to compare against competitors.', drivers: [] };
      const rivals = t.competitors
        .map((r) => ({ r, id: other(r, c.id), g: growth.get(other(r, c.id)) }))
        .filter((x): x is { r: Relationship; id: string; g: number } => x.g != null);
      if (!rivals.length) return { raw: 0, explain: 'No competitors with comparable data.', drivers: [] };
      const gaps = rivals.map((x) => ({ ...x, gap: x.r.weight * clamp((x.g - own) / 0.2) }));
      const raw = gaps.reduce((a, x) => a + x.gap, 0);
      const top = [...gaps].sort((a, b) => b.gap - a.gap)[0];
      return {
        raw,
        explain:
          top.gap > 0
            ? `${name(top.id)} is growing ${signedPct(top.g)}/yr against ${signedPct(own)}/yr.`
            : `Growing as fast as or faster than its ${rivals.length} competitor${rivals.length === 1 ? '' : 's'}.`,
        drivers: gaps.filter((x) => x.gap > 0).map((x) => ({ rel: x.r, counterpartyId: x.id, value: x.gap, reason: 'Faster-growing competitor' })),
      };
    },
    relationshipInstability: (c, t) => {
      if (!t.all.length) return { raw: 0, explain: 'No relationships recorded.', drivers: [] };
      const score = (r: Relationship) =>
        (r.detail?.status === 'ended' || r.detail?.status === 'disputed' ? 1 : 0) + (r.confidence < 0.6 ? 0.5 : 0);
      const flagged = t.all.filter((r) => score(r) > 0);
      return {
        raw: t.all.reduce((a, r) => a + score(r), 0) / t.all.length,
        explain: flagged.length
          ? `${flagged.length} of ${t.all.length} ties are ended, disputed or thinly evidenced.`
          : 'All ties are active and well evidenced.',
        drivers: flagged.map((r) => ({
          rel: r,
          counterpartyId: other(r, c.id),
          value: score(r),
          reason: r.detail?.status === 'ended' || r.detail?.status === 'disputed' ? `Relationship ${r.detail.status}` : 'Thinly evidenced tie',
        })),
      };
    },
    fundamentals: (c) => {
      const w = weak.get(c.id);
      if (w == null) return { raw: null, explain: 'No SEC financials.', drivers: [] };
      const g = growth.get(c.id);
      const m = netMargin(c);
      return {
        raw: w,
        explain: `Revenue ${g != null ? `${signedPct(g)}/yr` : 'n/a'}, net margin ${m != null ? pct(m) : 'n/a'}.`,
        drivers: [],
      };
    },
  };

  // ----- Opportunity factors -----
  const oppRaw: Record<OpportunityFactorKey, (c: Company, t: Ties) => RawFactor> = {
    demandPull: (c, t) => {
      if (!t.customers.length) return { raw: null, explain: 'No recorded customers.', drivers: [] };
      const known = t.customers.filter((r) => growth.get(r.target) != null);
      if (!known.length) return { raw: null, explain: 'No financial data for its customers.', drivers: [] };
      const total = known.reduce((a, r) => a + effectiveMateriality(r, c.id), 0);
      const raw = known.reduce((a, r) => a + effectiveMateriality(r, c.id) * clamp(growth.get(r.target)!, -0.5, 1), 0) / total;
      const top = [...known].sort((a, b) => effectiveMateriality(b, c.id) * growth.get(b.target)! - effectiveMateriality(a, c.id) * growth.get(a.target)!)[0];
      return {
        raw,
        explain:
          growth.get(top.target)! > 0
            ? `${name(top.target)} is growing ${signedPct(growth.get(top.target)!)}/yr; customers average ${signedPct(raw)}/yr.`
            : `Customers average ${signedPct(raw)}/yr revenue growth.`,
        drivers: known
          .filter((r) => growth.get(r.target)! > 0)
          .map((r) => ({ rel: r, counterpartyId: r.target, value: effectiveMateriality(r, c.id) * clamp(growth.get(r.target)!, 0, 1), reason: 'Fast-growing customer' })),
      };
    },
    chokepoint: (c, t) => {
      // Only suppliers are compared on this factor; otherwise any customer would outrank the many companies without one.
      if (!t.customers.length) return { raw: null, explain: 'No recorded customers.', drivers: [] };
      const critical = t.customers.filter((r) => r.weight >= SINGLE_SOURCE);
      const reach = t.customers.reduce((a, r) => a + r.weight ** 2, 0);
      const bc = metrics.byId.get(c.id)?.betweenness ?? 0;
      return {
        // Betweenness is normalized 0–1 but rarely above ~0.2; scale it into the same range as reach.
        raw: reach + bc * 10,
        explain: critical.length
          ? `Critical supplier to ${critical.map((r) => name(r.target)).join(', ')}.`
          : bc > 0.02
            ? `Bridges otherwise separate parts of the network (betweenness ${bc.toFixed(3)}).`
            : t.customers.length
              ? `Supplies ${t.customers.length} customer${t.customers.length === 1 ? '' : 's'}; none depend on it critically.`
              : 'No recorded customers.',
        drivers: t.customers.map((r) => ({
          rel: r,
          counterpartyId: r.target,
          value: r.weight ** 2,
          reason: r.weight >= SINGLE_SOURCE ? 'Critical supplier (pricing power)' : 'Supplier position',
        })),
      };
    },
    ecosystemMomentum: (c, t) => {
      const ties = [...t.partners, ...t.investees];
      if (!ties.length) return { raw: null, explain: 'No partners or investments recorded.', drivers: [] };
      const deals = ties.reduce((a, r) => a + (r.detail?.materiality?.dealValueUsdB ?? 0), 0);
      const dealBonus = 0.3 * clamp(Math.log1p(deals) / Math.log1p(100));
      const known = ties.filter((r) => growth.get(other(r, c.id)) != null);
      if (!known.length && deals === 0) return { raw: null, explain: 'No financial data for its partners or investees.', drivers: [] };
      const total = known.reduce((a, r) => a + r.weight, 0);
      const avg = total ? known.reduce((a, r) => a + r.weight * clamp(growth.get(other(r, c.id))!, -0.5, 1), 0) / total : 0;
      return {
        raw: avg + dealBonus,
        explain:
          deals > 0
            ? `$${Math.round(deals)}B in recorded deals; partners and investees average ${signedPct(avg)}/yr.`
            : `Partners and investees average ${signedPct(avg)}/yr revenue growth.`,
        drivers: ties
          .map((r) => {
            const id = other(r, c.id);
            const g = growth.get(id) ?? 0;
            const d = r.detail?.materiality?.dealValueUsdB ?? 0;
            return { rel: r, counterpartyId: id, value: r.weight * clamp(g) + 0.3 * clamp(Math.log1p(d) / Math.log1p(100)), reason: d > 0 ? 'Large deal' : 'Growing partner' };
          })
          .filter((x) => x.value > 0),
      };
    },
    relativeMomentum: (c, t) => {
      const own = growth.get(c.id);
      if (own == null) return { raw: null, explain: 'No revenue history.', drivers: [] };
      const rivals = t.competitors
        .map((r) => ({ r, id: other(r, c.id), g: growth.get(other(r, c.id)) }))
        .filter((x): x is { r: Relationship; id: string; g: number } => x.g != null);
      if (!rivals.length) return { raw: null, explain: 'No competitors with comparable data.', drivers: [] };
      const total = rivals.reduce((a, x) => a + x.r.weight, 0);
      const avg = rivals.reduce((a, x) => a + x.r.weight * x.g, 0) / total;
      return {
        raw: clamp(own, -0.5, 1) - clamp(avg, -0.5, 1),
        explain: `Growing ${signedPct(own)}/yr against a competitor average of ${signedPct(avg)}/yr.`,
        drivers: rivals
          .filter((x) => own > x.g)
          .map((x) => ({ rel: x.r, counterpartyId: x.id, value: x.r.weight * clamp((own - x.g) / 0.2), reason: 'Out-growing this competitor' })),
      };
    },
    growthQuality: (c) => {
      const g = growth.get(c.id);
      if (g == null) return { raw: null, explain: 'No SEC financials.', drivers: [] };
      const t = marginTrend(c) ?? 0;
      const rnd = rndIntensity(c) ?? 0;
      return {
        raw: clamp(g, -0.5, 1) + 0.5 * clamp(t, -0.3, 0.3) + 0.5 * clamp(rnd, 0, 0.4),
        explain: `Revenue ${signedPct(g)}/yr, margin ${t >= 0 ? 'up' : 'down'} ${Math.abs(Math.round(t * 100))}pp, R&D ${pct(rnd)} of revenue.`,
        drivers: [],
      };
    },
    newDeals: (c, t) => {
      const recent = t.all
        .map((r) => {
          const events = (r.detail?.events ?? []).filter((e) => {
            const at = eventTime(e.date);
            return at != null && now - at <= 24 && now - at >= 0;
          }).length;
          const since = r.detail?.since != null && now / 12 - r.detail.since <= 2 ? 1 : 0;
          const announced = r.detail?.status === 'announced' ? 1 : 0;
          return { r, v: announced * 1.5 + since + events * 0.5 };
        })
        .filter((x) => x.v > 0);
      const raw = recent.reduce((a, x) => a + x.v, 0);
      return {
        raw,
        explain: recent.length
          ? `${recent.length} relationship${recent.length === 1 ? '' : 's'} with recent deal activity.`
          : 'No recent deal activity recorded.',
        drivers: recent.map((x) => ({
          rel: x.r,
          counterpartyId: other(x.r, c.id),
          value: x.v,
          reason: x.r.detail?.status === 'announced' ? 'Newly announced' : 'Recent deal activity',
        })),
      };
    },
  };

  // ----- Evaluate, normalize, combine -----
  function evaluate<K extends FactorKey>(keys: readonly K[], fns: Record<K, (c: Company, t: Ties) => RawFactor>, w: Record<K, number>) {
    const raw = new Map<K, Map<string, RawFactor>>();
    for (const k of keys) raw.set(k, new Map(companies.map((c) => [c.id, fns[k](c, ties.get(c.id)!)])));
    const scores = new Map<K, Map<string, number | null>>();
    for (const k of keys) scores.set(k, percentiles(new Map([...raw.get(k)!].map(([id, f]) => [id, f.raw]))));

    const out = new Map<string, { score: number; coverage: number; factors: Factor[]; drivers: Driver[] }>();
    const totalWeight = keys.reduce((a, k) => a + Math.max(0, w[k]), 0);
    for (const c of companies) {
      const avail = keys.filter((k) => scores.get(k)!.get(c.id) != null && w[k] > 0);
      const availWeight = avail.reduce((a, k) => a + w[k], 0);
      const factors: Factor[] = keys.map((k) => {
        const s = scores.get(k)!.get(c.id) ?? null;
        const f = raw.get(k)!.get(c.id)!;
        return {
          key: k,
          label: FACTOR_META[k].label,
          raw: f.raw,
          score: s,
          weight: w[k],
          // A missing factor counts as the median, so thin data pulls a score toward neutral
          // instead of letting the few factors that do have data speak for the whole score.
          contribution: w[k] > 0 && totalWeight > 0 ? (100 * (s ?? MISSING_SCORE) * w[k]) / totalWeight : 0,
          explain: f.explain,
        };
      });
      const score = factors.reduce((a, f) => a + f.contribution, 0);

      // Attribute each factor's contribution to its relationships, in proportion to their values.
      // A relationship can feed several factors: sum its shares, and label it by the largest one.
      const byRel = new Map<string, { driver: Driver; largest: number }>();
      for (const f of factors) {
        if (f.contribution <= 0) continue;
        const ds = raw.get(f.key as K)!.get(c.id)!.drivers;
        const sum = ds.reduce((a, d) => a + d.value, 0);
        if (sum <= 0) continue;
        for (const d of ds) {
          const share = (f.contribution / 100) * (d.value / sum);
          const prev = byRel.get(d.rel.id);
          if (!prev) {
            byRel.set(d.rel.id, {
              driver: { relId: d.rel.id, counterpartyId: d.counterpartyId, contribution: share, factor: f.key, reason: d.reason },
              largest: share,
            });
            continue;
          }
          prev.driver.contribution += share;
          if (share > prev.largest) {
            prev.largest = share;
            prev.driver.factor = f.key;
            prev.driver.reason = d.reason;
          }
        }
      }
      out.set(c.id, {
        score,
        coverage: totalWeight > 0 ? availWeight / totalWeight : 0,
        factors,
        drivers: [...byRel.values()].map((x) => x.driver).sort((a, b) => b.contribution - a.contribution),
      });
    }
    return out;
  }

  const risk = evaluate(RISK_FACTORS, riskRaw, weights.risk);
  const opp = evaluate(OPPORTUNITY_FACTORS, oppRaw, weights.opportunity);
  const riskPct = percentiles(new Map([...risk].map(([id, r]) => [id, r.score])));
  const oppPct = percentiles(new Map([...opp].map(([id, o]) => [id, o.score])));

  const byId = new Map<string, CompanyLens>();
  for (const c of companies) {
    const r = risk.get(c.id)!;
    const o = opp.get(c.id)!;
    const rp = riskPct.get(c.id) ?? 0;
    const op = oppPct.get(c.id) ?? 0;
    byId.set(c.id, {
      risk: r.score,
      opportunity: o.score,
      riskPct: rp,
      opportunityPct: op,
      stance: stanceFor(rp, op),
      riskCoverage: r.coverage,
      opportunityCoverage: o.coverage,
      riskFactors: r.factors,
      opportunityFactors: o.factors,
      riskDrivers: r.drivers,
      opportunityDrivers: o.drivers,
    });
  }

  // Per-relationship: the largest share it contributes to either endpoint's score.
  const relRisk = new Map<string, { v: number; for: string; reason: string }>();
  const relOpp = new Map<string, { v: number; for: string; reason: string }>();
  for (const [id, lens] of byId) {
    for (const d of lens.riskDrivers) {
      if ((relRisk.get(d.relId)?.v ?? -1) < d.contribution) relRisk.set(d.relId, { v: d.contribution, for: id, reason: d.reason });
    }
    for (const d of lens.opportunityDrivers) {
      if ((relOpp.get(d.relId)?.v ?? -1) < d.contribution) relOpp.set(d.relId, { v: d.contribution, for: id, reason: d.reason });
    }
  }
  const maxRisk = Math.max(0, ...[...relRisk.values()].map((x) => x.v));
  const maxOpp = Math.max(0, ...[...relOpp.values()].map((x) => x.v));
  const byRel = new Map<string, RelLens>();
  for (const r of relationships) {
    if (!byCompany.has(r.source) || !byCompany.has(r.target)) continue;
    const rr = relRisk.get(r.id);
    const ro = relOpp.get(r.id);
    byRel.set(r.id, {
      relId: r.id,
      risk: rr && maxRisk > 0 ? rr.v / maxRisk : 0,
      opportunity: ro && maxOpp > 0 ? ro.v / maxOpp : 0,
      riskFor: rr?.for ?? null,
      riskReason: rr?.reason ?? null,
      opportunityFor: ro?.for ?? null,
      opportunityReason: ro?.reason ?? null,
    });
  }

  const singleSourceCount = relationships.filter(
    (r) => r.type === 'supplier' && r.weight >= SINGLE_SOURCE && byCompany.has(r.source) && byCompany.has(r.target),
  ).length;

  return { byId, byRel, singleSourceCount };
}

/** Quadrant split at the median of each score's percentile. */
export function stanceFor(riskPct: number, opportunityPct: number): Stance {
  const highRisk = riskPct >= 0.5;
  const highOpp = opportunityPct >= 0.5;
  if (highOpp) return highRisk ? 'watch' : 'add';
  return highRisk ? 'reduce' : 'hold';
}

/** Lens score for a kind, for components that switch between the two. */
export const lensScore = (l: CompanyLens, kind: LensKind) => (kind === 'risk' ? l.risk : l.opportunity);
export const lensPct = (l: CompanyLens, kind: LensKind) => (kind === 'risk' ? l.riskPct : l.opportunityPct);
export const lensFactors = (l: CompanyLens, kind: LensKind) => (kind === 'risk' ? l.riskFactors : l.opportunityFactors);
export const lensDrivers = (l: CompanyLens, kind: LensKind) => (kind === 'risk' ? l.riskDrivers : l.opportunityDrivers);
export const lensCoverage = (l: CompanyLens, kind: LensKind) => (kind === 'risk' ? l.riskCoverage : l.opportunityCoverage);
