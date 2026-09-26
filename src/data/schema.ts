/**
 * RelationshipViz data contract. Shared by the web app (runtime validation on load)
 * and the scraper pipeline (validation before writing public/data/dataset.json).
 */
import { z } from 'zod';

export const SECTORS = [
  'Information Technology',
  'Communication Services',
  'Consumer Discretionary',
  'Health Care',
  'Financials',
  'Industrials',
  'Consumer Staples',
  'Energy',
  'Materials',
  'Utilities',
  'Real Estate',
] as const;
export const SectorSchema = z.enum(SECTORS);
export type Sector = z.infer<typeof SectorSchema>;

/** Where a company comes from. Extend as new universes are added. */
export const UNIVERSES = ['SP500', 'GLOBAL', 'PRIVATE'] as const;
export const UniverseSchema = z.enum(UNIVERSES);
export type Universe = z.infer<typeof UniverseSchema>;

/**
 * Canonical relationship types. Direction matters:
 *  - supplier:   source supplies goods/services to target
 *  - investor:   source holds an equity stake in target
 *  - subsidiary: source is owned by target
 *  - partner / competitor: symmetric (direction is incidental)
 * `customer` is accepted from scrapers and normalized to a reversed `supplier`.
 */
export const RELATIONSHIP_TYPES = ['supplier', 'partner', 'investor', 'competitor', 'subsidiary'] as const;
export const RelationshipTypeSchema = z.enum(RELATIONSHIP_TYPES);
export type RelationshipType = z.infer<typeof RelationshipTypeSchema>;
export const RawRelationshipTypeSchema = z.enum([...RELATIONSHIP_TYPES, 'customer']);

export const SYMMETRIC_TYPES: ReadonlySet<RelationshipType> = new Set(['partner', 'competitor']);

export const HeadquartersSchema = z.object({
  city: z.string(),
  country: z.string(),
  countryCode: z.string().length(2),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const ProfileSchema = z.object({
  /** Plain-language description (Wikipedia summary). */
  description: z.string().nullable(),
  founded: z.number().int().nullable(),
  ceo: z.string().nullable(),
  founders: z.array(z.string()).default([]),
  exchanges: z.array(z.string()).default([]),
  /** Notable owned entities (names), from Wikidata. */
  subsidiaries: z.array(z.string()).default([]),
  parent: z.string().nullable().default(null),
  products: z.array(z.string()).default([]),
  wikipediaUrl: z.string().url().nullable(),
  wikidataId: z.string().nullable(),
});
export type Profile = z.infer<typeof ProfileSchema>;

export const FiscalYearSchema = z.object({
  fiscalYear: z.number().int(),
  /** Period end date, YYYY-MM-DD. */
  end: z.string(),
  /** Amounts in `currency` units (not billions). */
  revenue: z.number().nullable(),
  netIncome: z.number().nullable(),
  rnd: z.number().nullable(),
  /** Per-share values, in `currency` per share. Present when the bulk/cached filings report them. */
  epsDiluted: z.number().nullable().optional(),
  dividendsPerShare: z.number().nullable().optional(),
});
export type FiscalYear = z.infer<typeof FiscalYearSchema>;

export const FinancialsSchema = z.object({
  currency: z.string(),
  source: z.enum(['sec-xbrl']),
  sourceUrl: z.string().url(),
  annual: z.array(FiscalYearSchema),
});
export type Financials = z.infer<typeof FinancialsSchema>;

export const CompanySchema = z.object({
  /** Stable id. Ticker for listed companies; slug for private ones. */
  id: z.string().min(1),
  ticker: z.string().nullable(),
  name: z.string(),
  shortName: z.string(),
  sector: SectorSchema,
  industry: z.string(),
  hq: HeadquartersSchema,
  /** USD billions — market cap for listed, last reported valuation for private. 0 when unknown. */
  marketCap: z.number().nonnegative(),
  /** Where `marketCap` came from: the curated seed, Wikidata (with its date), or unknown. */
  marketCapSource: z.enum(['curated', 'wikidata', 'unknown']).optional(),
  marketCapAsOf: z.string().nullable().optional(),
  employees: z.number().int().nonnegative().nullable(),
  universe: UniverseSchema,
  cik: z.string().nullable().optional(),
  aliases: z.array(z.string()).default([]),
  website: z.string().url().nullable().optional(),
  profile: ProfileSchema.optional(),
  financials: FinancialsSchema.optional(),
});
export type Company = z.infer<typeof CompanySchema>;

export const EvidenceSchema = z.object({
  /** curated: our summary · filing: SEC text · press: company release · research: web research (news, analysis) */
  kind: z.enum(['curated', 'filing', 'press', 'research']),
  url: z.string().url(),
  /** Curated summary in our own words, or a short excerpt for scraped filings. */
  note: z.string(),
  date: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  publisher: z.string().nullable().optional(),
});
export type Evidence = z.infer<typeof EvidenceSchema>;

export const RELATIONSHIP_STATUSES = ['active', 'announced', 'ended', 'disputed'] as const;

export const RelationshipDetailSchema = z.object({
  /** Two or three sentences explaining what the relationship is and why it matters. */
  summary: z.string(),
  /** What moves between the companies: products, services, capital, IP. */
  flows: z.array(z.string()).default([]),
  materiality: z
    .object({
      /** Share of `of`'s revenue attributable to the counterparty, 0–1, when disclosed or reported. */
      revenueShare: z
        .object({ value: z.number().min(0).max(1), of: z.string(), year: z.number().int().nullable().optional(), basis: z.string() })
        .nullable()
        .optional(),
      /** Headline deal or investment value, USD billions. */
      dealValueUsdB: z.number().nonnegative().nullable().optional(),
      note: z.string().nullable().optional(),
    })
    .default({}),
  since: z.number().int().nullable().optional(),
  status: z.enum(RELATIONSHIP_STATUSES).default('active'),
  events: z
    .array(z.object({ date: z.string(), title: z.string(), url: z.string().url().nullable().optional() }))
    .default([]),
  /** verified: researched and checked by a person · machine: extracted by the LLM pipeline, unreviewed */
  provenance: z.enum(['verified', 'machine']),
  researchedAt: z.string(),
});
export type RelationshipDetail = z.infer<typeof RelationshipDetailSchema>;

export const RelationshipSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  type: RelationshipTypeSchema,
  /** Strength of the tie, 0–1 (e.g. revenue dependence, strategic importance). */
  weight: z.number().min(0).max(1),
  /** How sure we are the tie exists as described, 0–1. */
  confidence: z.number().min(0).max(1),
  evidence: z.array(EvidenceSchema).min(1),
  detail: RelationshipDetailSchema.optional(),
});
export type Relationship = z.infer<typeof RelationshipSchema>;

export const DatasetSchema = z
  .object({
    version: z.string(),
    generatedAt: z.string(),
    asOf: z.string(),
    notes: z.string().optional(),
    companies: z.array(CompanySchema),
    relationships: z.array(RelationshipSchema),
  })
  .superRefine((d, ctx) => {
    const ids = new Set<string>();
    for (const c of d.companies) {
      if (ids.has(c.id)) ctx.addIssue({ code: 'custom', message: `duplicate company id ${c.id}` });
      ids.add(c.id);
    }
    for (const r of d.relationships) {
      if (!ids.has(r.source)) ctx.addIssue({ code: 'custom', message: `${r.id}: unknown source ${r.source}` });
      if (!ids.has(r.target)) ctx.addIssue({ code: 'custom', message: `${r.id}: unknown target ${r.target}` });
      if (r.source === r.target) ctx.addIssue({ code: 'custom', message: `${r.id}: self-loop` });
    }
  });
export type Dataset = z.infer<typeof DatasetSchema>;
