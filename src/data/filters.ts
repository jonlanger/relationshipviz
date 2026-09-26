import type { Company, Dataset, Relationship, RelationshipType, Sector, Universe } from './schema';
import { RELATIONSHIP_TYPES, SECTORS, UNIVERSES } from './schema';

export interface Filters {
  sectors: Sector[];
  types: RelationshipType[];
  universes: Universe[];
  /** USD billions. */
  minMarketCap: number;
  /** 0–1. Default hides machine-extracted (scraped) links, which carry lower confidence. */
  minConfidence: number;
}

export const DEFAULT_FILTERS: Filters = {
  sectors: [...SECTORS],
  types: [...RELATIONSHIP_TYPES],
  universes: [...UNIVERSES],
  minMarketCap: 0,
  minConfidence: 0.5,
};

export function isDefaultFilters(f: Filters): boolean {
  return (
    f.sectors.length === SECTORS.length &&
    f.types.length === RELATIONSHIP_TYPES.length &&
    f.universes.length === UNIVERSES.length &&
    f.minMarketCap === DEFAULT_FILTERS.minMarketCap &&
    f.minConfidence === DEFAULT_FILTERS.minConfidence
  );
}

export function companyVisible(c: Company, f: Filters): boolean {
  return f.sectors.includes(c.sector) && f.universes.includes(c.universe) && c.marketCap >= f.minMarketCap;
}

export function relationshipVisible(r: Relationship, f: Filters): boolean {
  return f.types.includes(r.type) && r.confidence >= f.minConfidence;
}

export interface FilteredData {
  companies: Company[];
  relationships: Relationship[];
  companyIds: Set<string>;
  relationshipIds: Set<string>;
}

/** Relationships survive only when both endpoints are visible. */
export function applyFilters(dataset: Dataset, f: Filters): FilteredData {
  const companies = dataset.companies.filter((c) => companyVisible(c, f));
  const companyIds = new Set(companies.map((c) => c.id));
  const relationships = dataset.relationships.filter(
    (r) => relationshipVisible(r, f) && companyIds.has(r.source) && companyIds.has(r.target),
  );
  return { companies, relationships, companyIds, relationshipIds: new Set(relationships.map((r) => r.id)) };
}
