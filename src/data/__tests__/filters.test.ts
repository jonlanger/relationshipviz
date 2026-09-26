import { applyFilters, DEFAULT_FILTERS, isDefaultFilters } from '../filters';
import { co, dataset, rel } from './fixtures';

const d = dataset(
  [co('A'), co('B', { sector: 'Energy' }), co('C', { marketCap: 5 })],
  [rel('A', 'B'), rel('A', 'C', { type: 'partner' }), rel('B', 'C', { confidence: 0.4 })],
);

describe('applyFilters', () => {
  it('hides low-confidence links by default', () => {
    const f = applyFilters(d, DEFAULT_FILTERS);
    expect(f.relationships.map((r) => r.source + r.target)).toEqual(['AB', 'AC']);
  });

  it('drops relationships whose endpoint is filtered out', () => {
    const f = applyFilters(d, { ...DEFAULT_FILTERS, sectors: ['Information Technology'] });
    expect(f.companies.map((c) => c.id)).toEqual(['A', 'C']);
    expect(f.relationships).toHaveLength(1);
  });

  it('filters by market cap and type', () => {
    const f = applyFilters(d, { ...DEFAULT_FILTERS, minMarketCap: 50, types: ['supplier'] });
    expect(f.companyIds.has('C')).toBe(false);
    expect(f.relationships).toHaveLength(1);
  });

  it('detects default state', () => {
    expect(isDefaultFilters(DEFAULT_FILTERS)).toBe(true);
    expect(isDefaultFilters({ ...DEFAULT_FILTERS, minMarketCap: 1 })).toBe(false);
  });
});
