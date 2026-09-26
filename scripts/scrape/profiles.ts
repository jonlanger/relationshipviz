/**
 * Company profiles from Wikipedia (summary) + Wikidata (structured facts).
 * Output: data/scraped/profiles.json  { [companyId]: Profile & { website } }
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Profile } from '../../src/data/schema';
import { cachedFetch, loadUniverse, readJson, SCRAPED_DIR, WIKI_USER_AGENT, writeJson } from './lib';
import type { Constituent } from './sp500';

/** Wikipedia titles for companies outside the S&P 500 table. */
const TITLE_OVERRIDES: Record<string, string> = {
  TSM: 'TSMC',
  '005930.KS': 'Samsung_Electronics',
  ASML: 'ASML_Holding',
  '2317.TW': 'Foxconn',
  '000660.KS': 'SK_Hynix',
  ARM: 'Arm_Holdings',
  SAP: 'SAP',
  SONY: 'Sony_Group',
  TM: 'Toyota',
  NVO: 'Novo_Nordisk',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  EA: 'Electronic_Arts',
};

interface WikiSummary {
  extract?: string;
  wikibase_item?: string;
  content_urls?: { desktop?: { page?: string } };
  type?: string;
}

interface Claim {
  mainsnak: { datavalue?: { value: unknown } };
  rank: 'preferred' | 'normal' | 'deprecated';
  qualifiers?: Record<string, unknown[]>;
}
interface Entity {
  claims: Record<string, Claim[]>;
  labels?: { en?: { value: string } };
}

const opts = { userAgent: WIKI_USER_AGENT, perSecond: 2, maxAgeHours: 24 * 14 };

const claimsOf = (e: Entity, p: string) => (e.claims[p] ?? []).filter((c) => c.rank !== 'deprecated');
const itemIds = (e: Entity, p: string, current = false) =>
  claimsOf(e, p)
    // "current" = no end-time qualifier (P582); preferred rank first.
    .filter((c) => !current || !c.qualifiers?.P582)
    .sort((a, b) => (a.rank === 'preferred' ? -1 : 0) - (b.rank === 'preferred' ? -1 : 0))
    .map((c) => (c.mainsnak.datavalue?.value as { id?: string } | undefined)?.id)
    .filter((x): x is string => !!x);

async function labels(ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=labels&languages=en&ids=${batch.join('|')}`;
    const json = JSON.parse(await cachedFetch(url, opts)) as { entities: Record<string, Entity> };
    for (const [id, e] of Object.entries(json.entities)) if (e.labels?.en) out.set(id, e.labels.en.value);
  }
  return out;
}

export async function scrapeProfiles() {
  const companies = loadUniverse();
  const spPath = resolve(SCRAPED_DIR, 'sp500.json');
  const sp = existsSync(spPath) ? readJson<Constituent[]>(spPath) : [];
  const titleByTicker = new Map(sp.map((c) => [c.ticker, c.wikiTitle]));

  const raw: { id: string; summary: WikiSummary; entity: Entity | null }[] = [];
  for (const c of companies) {
    const title = TITLE_OVERRIDES[c.id] ?? (c.ticker ? titleByTicker.get(c.ticker) : null);
    if (!title) {
      console.warn(`  ${c.id}: no Wikipedia title`);
      continue;
    }
    try {
      const summary = JSON.parse(
        await cachedFetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}?redirect=true`, opts),
      ) as WikiSummary;
      let entity: Entity | null = null;
      if (summary.wikibase_item) {
        const ej = JSON.parse(
          await cachedFetch(`https://www.wikidata.org/wiki/Special:EntityData/${summary.wikibase_item}.json`, opts),
        ) as { entities: Record<string, Entity> };
        entity = Object.values(ej.entities)[0] ?? null;
      }
      raw.push({ id: c.id, summary, entity });
    } catch (err) {
      console.warn(`  ${c.id}: ${(err as Error).message}`);
    }
  }

  // Resolve every referenced item id to an English label in batches.
  const refIds = new Set<string>();
  for (const { entity } of raw) {
    if (!entity) continue;
    for (const p of ['P169', 'P112', 'P414', 'P355', 'P749', 'P1056']) itemIds(entity, p).forEach((id) => refIds.add(id));
  }
  const label = await labels([...refIds]);
  const names = (ids: string[], max: number) => ids.map((id) => label.get(id)).filter((x): x is string => !!x).slice(0, max);

  const out: Record<string, Profile & { website: string | null }> = {};
  for (const { id, summary, entity } of raw) {
    const inception = entity ? (claimsOf(entity, 'P571')[0]?.mainsnak.datavalue?.value as { time?: string } | undefined)?.time : undefined;
    const website = entity ? (claimsOf(entity, 'P856')[0]?.mainsnak.datavalue?.value as string | undefined) ?? null : null;
    out[id] = {
      description: summary.type === 'standard' ? summary.extract ?? null : null,
      founded: inception ? Number(inception.slice(1, 5)) || null : null,
      ceo: entity ? names(itemIds(entity, 'P169', true), 1)[0] ?? null : null,
      founders: entity ? names(itemIds(entity, 'P112'), 6) : [],
      exchanges: entity ? [...new Set(names(itemIds(entity, 'P414'), 4))] : [],
      subsidiaries: entity ? names(itemIds(entity, 'P355'), 12) : [],
      parent: entity ? names(itemIds(entity, 'P749', true), 1)[0] ?? null : null,
      products: entity ? names(itemIds(entity, 'P1056'), 10) : [],
      wikipediaUrl: summary.content_urls?.desktop?.page ?? null,
      wikidataId: summary.wikibase_item ?? null,
      website,
    };
  }
  writeJson(resolve(SCRAPED_DIR, 'profiles.json'), out);
  const withCeo = Object.values(out).filter((p) => p.ceo).length;
  console.log(`✓ Profiles: ${Object.keys(out).length}/${companies.length} companies (${withCeo} with CEO)`);
}

if (import.meta.url === `file://${process.argv[1]}`) scrapeProfiles();
