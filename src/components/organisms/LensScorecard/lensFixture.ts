/** Small, realistic universe for lens stories: a Taiwan foundry, its fabless customers, a rival. */
import type { Company, Relationship } from '@/data/schema';
import { computeMetrics } from '@/data/metrics';
import { computeLenses } from '@/data/lenses';

const fin = (revenues: number[], margin: number): Company['financials'] => ({
  currency: 'USD',
  source: 'sec-xbrl',
  sourceUrl: 'https://example.com',
  annual: revenues.map((r, i) => ({ fiscalYear: 2022 + i, end: `${2022 + i}-12-31`, revenue: r * 1e9, netIncome: r * 1e9 * margin, rnd: r * 1e9 * 0.12 })),
});
const co = (id: string, shortName: string, cc: string, country: string, marketCap: number, financials?: Company['financials']): Company => ({
  id, ticker: id, name: `${shortName} Inc.`, shortName, sector: 'Information Technology', industry: 'Semiconductors', universe: 'SP500',
  marketCap, employees: 1000, aliases: [], hq: { city: '', country, countryCode: cc, lat: 0, lng: 0 }, financials,
});
const ev = [{ kind: 'curated' as const, url: 'https://example.com', note: '' }];
const rel = (source: string, target: string, type: Relationship['type'], weight: number): Relationship => ({
  id: `${source}__${type}__${target}`.toLowerCase(), source, target, type, weight, confidence: 0.9, evidence: ev,
});

export const lensCompanies: Company[] = [
  co('TSM', 'TSMC', 'TW', 'Taiwan', 1000, fin([76, 70, 90, 120], 0.4)),
  co('NVDA', 'Nvidia', 'US', 'United States', 3900, fin([27, 61, 130, 216], 0.55)),
  co('AMD', 'AMD', 'US', 'United States', 250, fin([23, 23, 26, 32], 0.06)),
  co('INTC', 'Intel', 'US', 'United States', 100, fin([63, 54, 53, 50], -0.05)),
  co('MSFT', 'Microsoft', 'US', 'United States', 3500, fin([198, 212, 245, 280], 0.36)),
  co('AAPL', 'Apple', 'US', 'United States', 3000, fin([394, 383, 391, 400], 0.25)),
];
export const lensRelationships: Relationship[] = [
  rel('TSM', 'NVDA', 'supplier', 0.95),
  rel('TSM', 'AMD', 'supplier', 0.9),
  rel('TSM', 'AAPL', 'supplier', 0.95),
  rel('NVDA', 'MSFT', 'supplier', 0.9),
  rel('AMD', 'MSFT', 'supplier', 0.5),
  rel('INTC', 'MSFT', 'supplier', 0.4),
  rel('NVDA', 'AMD', 'competitor', 0.8),
  rel('AMD', 'INTC', 'competitor', 0.8),
];
export const lensIndex = new Map(lensCompanies.map((c) => [c.id, c]));
export const lensResult = computeLenses(lensCompanies, lensRelationships, computeMetrics(lensCompanies, lensRelationships), undefined, { asOf: '2025-06' });
