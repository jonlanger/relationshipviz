/**
 * Step 3 — Merge curated seed + scraped candidates, validate, and publish
 * public/data/dataset.json for the web app.
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  DatasetSchema,
  RelationshipDetailSchema,
  type Financials,
  type Profile,
  type Relationship,
  type RelationshipDetail,
} from '../../src/data/schema';
import { mergeRelationships, type RawRelationship } from '../../src/data/normalize';
import { ENRICHED_DIR, loadUniverse, OUT_FILE, readJson, SCRAPED_DIR, SEED_DIR, writeJson } from './lib';
import type { Constituent } from './sp500';

export function merge() {
  const companies = loadUniverse();
  for (const c of companies) c.marketCapSource ??= 'curated';
  const curated = readJson<RawRelationship[]>(resolve(SEED_DIR, 'relationships.curated.json'));

  const spPath = resolve(SCRAPED_DIR, 'sp500.json');
  if (existsSync(spPath)) {
    const cik = new Map(readJson<Constituent[]>(spPath).map((c) => [c.ticker, c.cik]));
    // Seed CIKs win: they pin companies whose filing history lives under an older CIK.
    for (const c of companies) if (!c.cik && c.ticker && cik.has(c.ticker)) c.cik = cik.get(c.ticker)!;
  }

  // Profiles (Wikipedia/Wikidata) and financials (SEC XBRL).
  const optional = <T>(path: string, fallback: T): T => (existsSync(path) ? readJson<T>(path) : fallback);
  const profiles = optional<Record<string, Profile & { website: string | null }>>(resolve(SCRAPED_DIR, 'profiles.json'), {});
  const financials = optional<Record<string, Financials>>(resolve(SCRAPED_DIR, 'financials.json'), {});
  for (const c of companies) {
    const p = profiles[c.id];
    if (p) {
      const { website, ...profile } = p;
      c.profile = profile;
      c.website ??= website;
    }
    if (financials[c.id]) c.financials = financials[c.id];
  }

  const edgarPath = resolve(SCRAPED_DIR, 'edgar-relationships.json');
  const scraped = existsSync(edgarPath) ? readJson<RawRelationship[]>(edgarPath) : [];

  const relationships: Relationship[] = mergeRelationships(curated, scraped);

  // Relationship detail: hand-verified research wins over machine extraction.
  const verified = optional<Record<string, RelationshipDetail>>(resolve(SEED_DIR, 'relationships.details.json'), {});
  const machine = optional<Record<string, RelationshipDetail>>(resolve(ENRICHED_DIR, 'relationships.details.json'), {});
  const researchEvidence = optional<Record<string, Relationship['evidence']>>(resolve(SEED_DIR, 'relationships.sources.json'), {});
  const machineEvidence = optional<Record<string, Relationship['evidence']>>(resolve(ENRICHED_DIR, 'relationships.sources.json'), {});
  let detailed = 0;
  for (const r of relationships) {
    const d = verified[r.id] ?? machine[r.id];
    if (d) {
      r.detail = RelationshipDetailSchema.parse(d);
      detailed++;
    }
    const extra = [...(researchEvidence[r.id] ?? []), ...(verified[r.id] ? [] : machineEvidence[r.id] ?? [])];
    const seen = new Set(r.evidence.map((e) => e.url));
    for (const e of extra) {
      if (seen.has(e.url)) continue;
      r.evidence.push(e);
      seen.add(e.url);
    }
  }
  const dataset = DatasetSchema.parse({
    version: '0.1.0',
    generatedAt: new Date().toISOString(),
    asOf: '2025-06',
    notes:
      'Market caps and headcounts for the curated companies are approximate (mid-2025); other S&P 500 companies use the latest Wikidata market cap, with its date. Private-company values are last reported valuations. Curated relationships summarize public reporting in our own words; scraped relationships quote SEC filings. Company descriptions are from Wikipedia (CC BY-SA 4.0); structured facts from Wikidata (CC0); financials from SEC XBRL filings.',
    companies,
    relationships,
  });
  writeJson(OUT_FILE, dataset);
  const byKind = relationships.reduce<Record<string, number>>((acc, r) => {
    for (const k of new Set(r.evidence.map((e) => e.kind))) acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`✓ dataset.json: ${companies.length} companies, ${relationships.length} relationships`, byKind);
  console.log(
    `  profiles ${companies.filter((c) => c.profile).length} · financials ${companies.filter((c) => c.financials).length} · detailed links ${detailed} (${Object.keys(verified).length} verified)`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) merge();
