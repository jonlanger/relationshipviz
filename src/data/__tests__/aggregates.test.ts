import { companySupplyFlow, computeKpis, crossBorderLinks, degreeHistogram, sectorMatrix, sectorSupplyFlow, topBy } from '../aggregates';
import { computeMetrics } from '../metrics';
import { SECTORS } from '../schema';
import { co, rel } from './fixtures';

const tw = { city: 'Hsinchu', country: 'Taiwan', countryCode: 'TW', lat: 24.8, lng: 121 };
const companies = [
  co('TSM', { hq: tw }),
  co('AAPL'),
  co('NVDA'),
  co('MSFT', { sector: 'Communication Services' }),
  co('LONE'),
];
const rels = [
  rel('TSM', 'AAPL', { weight: 0.9 }),
  rel('TSM', 'NVDA', { weight: 0.9 }),
  rel('NVDA', 'MSFT', { weight: 0.8 }),
  rel('AAPL', 'MSFT', { type: 'competitor' }),
];
const metrics = computeMetrics(companies, rels);

describe('computeMetrics', () => {
  it('computes degree and directional counts', () => {
    expect(metrics.byId.get('TSM')).toMatchObject({ degree: 2, outgoing: 2, incoming: 0 });
    expect(metrics.byId.get('NVDA')).toMatchObject({ degree: 2, outgoing: 1, incoming: 1 });
    expect(metrics.byId.get('LONE')!.degree).toBe(0);
  });

  it('assigns every connected node a ranked community', () => {
    for (const id of ['TSM', 'AAPL', 'NVDA', 'MSFT']) expect(metrics.byId.get(id)!.community).toBeGreaterThanOrEqual(0);
  });
});

describe('aggregates', () => {
  it('computes KPIs', () => {
    const k = computeKpis(companies, rels, metrics);
    expect(k.companies).toBe(5);
    expect(k.relationships).toBe(4);
    expect(k.crossBorderShare).toBeCloseTo(0.5);
    expect(k.countries).toBe(2);
  });

  it('builds a symmetric sector matrix', () => {
    const m = sectorMatrix(companies, rels);
    const it = SECTORS.indexOf('Information Technology');
    const cs = SECTORS.indexOf('Communication Services');
    expect(m[it][cs]).toBe(2);
    expect(m[cs][it]).toBe(2);
    expect(m[it][it]).toBe(2);
  });

  it('builds company and sector supply flows', () => {
    const f = companySupplyFlow('NVDA', companies, rels);
    expect(f.nodes.map((n) => n.id).sort()).toEqual(['C:NVDA', 'L:TSM', 'R:MSFT']);
    expect(f.links).toHaveLength(2);
    const s = sectorSupplyFlow(companies, rels);
    expect(s.links.reduce((a, l) => a + l.value, 0)).toBeCloseTo(2.6);
    expect(companySupplyFlow('LONE', companies, rels).nodes).toHaveLength(0);
  });

  it('ranks, histograms and geo-links', () => {
    expect(topBy(companies, metrics, 'degree', 2)).toHaveLength(2);
    const h = degreeHistogram(metrics);
    expect(h[0]).toEqual({ degree: 0, count: 1 });
    expect(crossBorderLinks(companies, rels)).toHaveLength(2);
  });
});
