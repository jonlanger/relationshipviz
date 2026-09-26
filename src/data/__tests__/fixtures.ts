import type { Company, Dataset, Relationship } from '../schema';

export const co = (id: string, over: Partial<Company> = {}): Company => ({
  id,
  ticker: id,
  name: `${id} Inc.`,
  shortName: id,
  sector: 'Information Technology',
  industry: 'Semiconductors',
  hq: { city: 'X', country: 'United States', countryCode: 'US', lat: 0, lng: 0 },
  marketCap: 100,
  employees: 1000,
  universe: 'SP500',
  cik: null,
  aliases: [],
  ...over,
});

export const rel = (source: string, target: string, over: Partial<Relationship> = {}): Relationship => ({
  id: `${source}__${over.type ?? 'supplier'}__${target}`.toLowerCase(),
  source,
  target,
  type: 'supplier',
  weight: 0.5,
  confidence: 0.9,
  evidence: [{ kind: 'curated', url: 'https://example.com', note: 'n' }],
  ...over,
});

export const dataset = (companies: Company[], relationships: Relationship[]): Dataset => ({
  version: 't',
  generatedAt: '2025-01-01',
  asOf: '2025-01',
  companies,
  relationships,
});
