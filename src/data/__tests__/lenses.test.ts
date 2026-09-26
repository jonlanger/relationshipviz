import { describe, expect, it } from 'vitest';
import type { Company, FiscalYear } from '../schema';
import { computeMetrics } from '../metrics';
import {
  computeLenses,
  DEFAULT_LENS_WEIGHTS,
  effectiveMateriality,
  hhi,
  MISSING_SCORE,
  percentiles,
  revenueCagr,
  stanceFor,
  weakness,
  type LensWeights,
} from '../lenses';
import { co, rel } from './fixtures';

const fin = (revenues: number[], margin = 0.1): Company['financials'] => ({
  currency: 'USD',
  source: 'sec-xbrl',
  sourceUrl: 'https://example.com',
  annual: revenues.map<FiscalYear>((revenue, i) => ({
    fiscalYear: 2021 + i,
    end: `${2021 + i}-12-31`,
    revenue,
    netIncome: revenue * margin,
    rnd: revenue * 0.05,
  })),
});

const lenses = (companies: Company[], rels: ReturnType<typeof rel>[], weights?: LensWeights) =>
  computeLenses(companies, rels, computeMetrics(companies, rels), weights, { asOf: '2025-06' });

describe('helpers', () => {
  it('hhi is 1 for a single weight and 1/n for equal weights', () => {
    expect(hhi([0.7])).toBe(1);
    expect(hhi([0.5, 0.5, 0.5, 0.5])).toBeCloseTo(0.25);
    expect(hhi([])).toBe(0);
  });

  it('revenueCagr compounds over the window and needs two years', () => {
    expect(revenueCagr(co('A', { financials: fin([100, 121]) }))).toBeCloseTo(0.21);
    expect(revenueCagr(co('A', { financials: fin([100, 110, 121, 133.1]) }))).toBeCloseTo(0.1);
    expect(revenueCagr(co('A', { financials: fin([100]) }))).toBeNull();
    expect(revenueCagr(co('A'))).toBeNull();
  });

  it('weakness is high for shrinking loss-makers and zero for healthy growers', () => {
    expect(weakness(co('A', { financials: fin([100, 80, 60], -0.2) }))!).toBeGreaterThan(0.7);
    expect(weakness(co('A', { financials: fin([100, 120, 140], 0.2) }))).toBe(0);
    expect(weakness(co('A'))).toBeNull();
  });

  it('a disclosed revenue share raises materiality only for the company whose revenue it is', () => {
    const r = rel('S', 'C', {
      weight: 0.4,
      detail: {
        summary: 's', flows: [], status: 'active', events: [], provenance: 'verified', researchedAt: '2025-01-01',
        materiality: { revenueShare: { value: 0.3, of: 'S', basis: 'filing' } },
      },
    });
    expect(effectiveMateriality(r, 'S')).toBe(1);
    expect(effectiveMateriality(r, 'C')).toBe(0.4);
  });

  it('percentiles share the lower rank on ties and skip missing values', () => {
    const p = percentiles(new Map<string, number | null>([['a', 0], ['b', 0], ['c', 5], ['d', 10], ['e', null]]));
    expect(p.get('a')).toBe(0);
    expect(p.get('b')).toBe(0);
    expect(p.get('c')).toBeCloseTo(2 / 3);
    expect(p.get('d')).toBe(1);
    expect(p.get('e')).toBeNull();
  });

  it('stance splits the quadrant at the median', () => {
    expect(stanceFor(0.2, 0.8)).toBe('add');
    expect(stanceFor(0.8, 0.8)).toBe('watch');
    expect(stanceFor(0.8, 0.2)).toBe('reduce');
    expect(stanceFor(0.2, 0.2)).toBe('hold');
  });
});

describe('computeLenses', () => {
  const healthy = fin([100, 110, 121, 133]);
  const companies = [
    co('FAB', { hq: { city: 'Hsinchu', country: 'Taiwan', countryCode: 'TW', lat: 0, lng: 0 }, financials: healthy }),
    co('DEP', { financials: healthy }), // single-sourced from FAB
    co('DIV', { financials: healthy }), // many small suppliers
    co('S1', { financials: healthy }),
    co('S2', { financials: healthy }),
    co('S3', { financials: healthy }),
    co('PRIV'), // no financials
  ];
  const rels = [
    rel('FAB', 'DEP', { weight: 0.95 }),
    rel('S1', 'DIV', { weight: 0.3 }),
    rel('S2', 'DIV', { weight: 0.3 }),
    rel('S3', 'DIV', { weight: 0.3 }),
    rel('S1', 'PRIV', { weight: 0.3, type: 'partner' }),
  ];

  it('scores a single-source, cross-strait dependency as riskier than a diversified supply base', () => {
    const L = lenses(companies, rels);
    const dep = L.byId.get('DEP')!;
    const div = L.byId.get('DIV')!;
    expect(dep.risk).toBeGreaterThan(div.risk);
    const f = (k: string, l = dep) => l.riskFactors.find((x) => x.key === k)!;
    expect(f('supplierConcentration').score!).toBeGreaterThan(f('supplierConcentration', div).score!);
    expect(f('geoExposure').explain).toMatch(/FAB in Taiwan/);
    expect(dep.riskDrivers[0]).toMatchObject({ counterpartyId: 'FAB' });
    expect(L.singleSourceCount).toBe(1);
  });

  it('counts factors without data as the median and reports coverage', () => {
    const L = lenses(companies, rels);
    const priv = L.byId.get('PRIV')!;
    const fundamentals = priv.riskFactors.find((f) => f.key === 'fundamentals')!;
    expect(fundamentals.score).toBeNull();
    const totalWeight = Object.values(DEFAULT_LENS_WEIGHTS.risk).reduce((a, b) => a + b, 0);
    expect(fundamentals.contribution).toBeCloseTo((100 * MISSING_SCORE * DEFAULT_LENS_WEIGHTS.risk.fundamentals) / totalWeight);
    expect(priv.riskCoverage).toBeLessThan(1);
    expect(priv.riskFactors.reduce((a, f) => a + f.contribution, 0)).toBeCloseTo(priv.risk);
    expect(priv.risk).toBeLessThanOrEqual(100);
    // DEP has financials and suppliers but no customers: only customer concentration is missing.
    expect(L.byId.get('DEP')!.riskCoverage).toBeCloseTo(1 - DEFAULT_LENS_WEIGHTS.risk.customerConcentration / totalWeight);
  });

  it('is deterministic', () => {
    const a = lenses(companies, rels);
    const b = lenses(companies, rels);
    expect([...a.byId].map(([id, l]) => [id, l.risk, l.opportunity])).toEqual([...b.byId].map(([id, l]) => [id, l.risk, l.opportunity]));
  });

  it('moves scores in the direction of the weights', () => {
    const geoOnly: LensWeights = {
      ...DEFAULT_LENS_WEIGHTS,
      risk: Object.fromEntries(Object.keys(DEFAULT_LENS_WEIGHTS.risk).map((k) => [k, k === 'geoExposure' ? 1 : 0])) as LensWeights['risk'],
    };
    const base = lenses(companies, rels);
    const geo = lenses(companies, rels, geoOnly);
    // FAB (in Taiwan) and DEP (depends on it) share the top geo score; S-companies have none.
    expect(geo.byId.get('FAB')!.risk).toBe(100);
    expect(geo.byId.get('S1')!.risk).toBe(0);
    expect(geo.byId.get('FAB')!.risk).toBeGreaterThan(base.byId.get('FAB')!.risk);
  });

  it('credits a supplier with demand pull from fast-growing customers', () => {
    const fast = fin([100, 200, 400, 800]);
    const slow = fin([100, 100, 100, 100]);
    const cs = [co('UP', { financials: healthy }), co('DOWN', { financials: healthy }), co('HOT', { financials: fast }), co('COLD', { financials: slow })];
    const rs = [rel('UP', 'HOT', { weight: 0.8 }), rel('DOWN', 'COLD', { weight: 0.8 })];
    const L = lenses(cs, rs);
    expect(L.byId.get('UP')!.opportunity).toBeGreaterThan(L.byId.get('DOWN')!.opportunity);
    expect(L.byId.get('UP')!.opportunityDrivers[0]).toMatchObject({ counterpartyId: 'HOT', reason: 'Fast-growing customer' });
  });

  it('attributes relationship-level scores normalized to the strongest link', () => {
    const L = lenses(companies, rels);
    const max = Math.max(...[...L.byRel.values()].map((r) => r.risk));
    expect(max).toBe(1);
    expect(L.byRel.get(rels[0].id)!.riskFor).toBe('DEP');
  });
});
