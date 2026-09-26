/**
 * Step 1b — Generate Company records for S&P 500 constituents that aren't in the curated seed.
 * Output: data/scraped/companies.auto.json (Company[])
 *
 * Identity, sector and industry come from the constituents table (Wikipedia). Headquarters
 * coordinates, headcount and market cap come from Wikidata when present; otherwise HQ falls back
 * to a state or country centroid and market cap is marked unknown. The seed always wins on merge.
 *
 *   npm run scrape:universe -- --limit 20
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { SectorSchema, type Company } from '../../src/data/schema';
import { shortNameOf } from '../../src/lib/names';
import { cachedFetch, readJson, SCRAPED_DIR, SEED_DIR, WIKI_USER_AGENT, writeJson } from './lib';
import type { Constituent } from './sp500';

const opts = { userAgent: WIKI_USER_AGENT, perSecond: 2, maxAgeHours: 24 * 30 };

/** Approximate geographic centers, for HQs Wikidata can't place. */
const US_STATES: Record<string, [number, number]> = {
  Alabama: [32.8, -86.8], Alaska: [61.4, -152.3], Arizona: [33.7, -111.4], Arkansas: [35.0, -92.4], California: [36.1, -119.7],
  Colorado: [39.1, -105.3], Connecticut: [41.6, -72.8], Delaware: [39.3, -75.5], 'D.C.': [38.9, -77.0], Florida: [27.8, -81.7],
  Georgia: [33.0, -83.6], Hawaii: [21.1, -157.5], Idaho: [44.2, -114.5], Illinois: [40.3, -89.0], Indiana: [39.8, -86.3],
  Iowa: [42.0, -93.2], Kansas: [38.5, -96.7], Kentucky: [37.7, -84.7], Louisiana: [31.2, -91.9], Maine: [44.7, -69.4],
  Maryland: [39.1, -76.8], Massachusetts: [42.2, -71.5], Michigan: [43.3, -84.5], Minnesota: [45.7, -93.9], Mississippi: [32.7, -89.7],
  Missouri: [38.5, -92.3], Montana: [46.9, -110.5], Nebraska: [41.1, -98.3], Nevada: [38.3, -117.1], 'New Hampshire': [43.5, -71.6],
  'New Jersey': [40.3, -74.5], 'New Mexico': [34.8, -106.2], 'New York': [42.2, -74.9], 'North Carolina': [35.6, -79.8],
  'North Dakota': [47.5, -99.8], Ohio: [40.4, -82.8], Oklahoma: [35.6, -96.9], Oregon: [44.6, -122.1], Pennsylvania: [40.6, -77.2],
  'Rhode Island': [41.7, -71.5], 'South Carolina': [33.9, -80.9], 'South Dakota': [44.3, -99.4], Tennessee: [35.7, -86.7],
  Texas: [31.1, -97.6], Utah: [40.2, -111.9], Vermont: [44.0, -72.7], Virginia: [37.8, -78.2], Washington: [47.4, -121.5],
  'West Virginia': [38.5, -81.0], Wisconsin: [44.3, -89.6], Wyoming: [42.8, -107.3],
};
const COUNTRIES: Record<string, { code: string; at: [number, number] }> = {
  Ireland: { code: 'IE', at: [53.35, -6.26] },
  'United Kingdom': { code: 'GB', at: [51.51, -0.13] },
  Switzerland: { code: 'CH', at: [47.37, 8.54] },
  Bermuda: { code: 'BM', at: [32.29, -64.78] },
  Canada: { code: 'CA', at: [43.65, -79.38] },
  Netherlands: { code: 'NL', at: [52.37, 4.9] },
};

export function parseHq(hqLocation: string): Company['hq'] | null {
  const parts = hqLocation.split(',').map((p) => p.replace(/\[\d+\]/g, '').trim());
  const city = parts[0] ?? '';
  const region = parts[parts.length - 1] ?? '';
  if (US_STATES[region]) {
    const [lat, lng] = US_STATES[region];
    return { city, country: 'United States', countryCode: 'US', lat, lng };
  }
  const c = COUNTRIES[region];
  if (c) return { city, country: region, countryCode: c.code, lat: c.at[0], lng: c.at[1] };
  return null;
}

// ---------- Wikidata ----------

interface Claim {
  mainsnak: { datavalue?: { value: unknown } };
  rank: 'preferred' | 'normal' | 'deprecated';
  qualifiers?: Record<string, { datavalue?: { value: { time?: string } } }[]>;
}
interface Entity {
  claims: Record<string, Claim[]>;
}

const claims = (e: Entity, p: string) => (e.claims[p] ?? []).filter((c) => c.rank !== 'deprecated');
const timeOf = (c: Claim) => c.qualifiers?.P585?.[0]?.datavalue?.value.time ?? '';

/** The latest (by P585 point in time) quantity claim, optionally restricted to one unit. */
function latestQuantity(e: Entity, p: string, unit?: string): { amount: number; time: string } | null {
  const list = claims(e, p)
    .map((c) => ({ v: c.mainsnak.datavalue?.value as { amount?: string; unit?: string } | undefined, time: timeOf(c), rank: c.rank }))
    .filter((x) => x.v?.amount && (!unit || x.v.unit?.endsWith(`/${unit}`)))
    .sort((a, b) => (a.rank === 'preferred' ? -1 : 0) - (b.rank === 'preferred' ? -1 : 0) || b.time.localeCompare(a.time));
  return list[0] ? { amount: Number(list[0].v!.amount), time: list[0].time.slice(1, 11) } : null;
}

const itemId = (c: Claim) => (c.mainsnak.datavalue?.value as { id?: string } | undefined)?.id;
const coordOf = (e: Entity) => claims(e, 'P625')[0]?.mainsnak.datavalue?.value as { latitude: number; longitude: number } | undefined;

async function entities(ids: string[]): Promise<Map<string, Entity>> {
  const out = new Map<string, Entity>();
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=claims&ids=${batch.join('|')}`;
    const json = JSON.parse(await cachedFetch(url, opts)) as { entities: Record<string, Entity> };
    for (const [id, e] of Object.entries(json.entities)) if (e.claims) out.set(id, e);
  }
  return out;
}

/** Common words that can't serve as a matching alias on their own (they'd match ordinary prose). */
const COMMON_WORDS = new Set([
  'Ball', 'Carrier', 'Waters', 'Pool', 'Southern', 'Dominion', 'Principal', 'Regions', 'Progressive', 'Match', 'Block',
  'Target', 'Discover', 'Fox', 'News', 'Paramount', 'Constellation', 'Equity', 'Public', 'Global', 'General', 'United',
  'American', 'First', 'Republic', 'Realty', 'Cardinal', 'Genuine', 'Ventas', 'Linde', 'Allegion', 'Loews', 'Citizens', 'Mosaic',
  'Hologic', 'Assurant', 'Leidos', 'Nucor', 'Corning', 'Amcor', 'Masco', 'Xylem', 'Trane', 'Fortive', 'Veralto', 'Tapestry',
  'Apollo', 'Aptiv', 'Edison', 'Entergy', 'Evergy', 'Exelon', 'Ameren', 'Truist', 'Steris', 'Teleflex', 'Insulet', 'Incyte',
]);

export async function buildUniverse(limit = Infinity): Promise<Company[]> {
  const seed = readJson<Company[]>(resolve(SEED_DIR, 'companies.json'));
  const sp = readJson<Constituent[]>(resolve(SCRAPED_DIR, 'sp500.json'));
  const seedTickers = new Set(seed.map((c) => c.ticker));
  const seedCiks = new Set(seed.map((c) => c.cik).filter(Boolean));

  // One record per company: skip dual share classes (GOOG/GOOGL, FOX/FOXA, NWS/NWSA) by CIK.
  const seenCik = new Set<string>();
  const todo = sp
    .filter((c) => {
      if (seedTickers.has(c.ticker) || seedCiks.has(c.cik)) return false;
      if (seenCik.has(c.cik)) return false;
      seenCik.add(c.cik);
      return true;
    })
    .filter((c) => !sp.some((o) => o.cik === c.cik && seedTickers.has(o.ticker)))
    .slice(0, limit);

  // Wikipedia summary → Wikidata item.
  const qid = new Map<string, string>();
  for (const c of todo) {
    if (!c.wikiTitle) continue;
    try {
      const s = JSON.parse(
        await cachedFetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(c.wikiTitle)}?redirect=true`, opts),
      ) as { wikibase_item?: string };
      if (s.wikibase_item) qid.set(c.ticker, s.wikibase_item);
    } catch (err) {
      console.warn(`  ${c.ticker}: ${(err as Error).message}`);
    }
  }
  const companyEntities = await entities([...new Set(qid.values())]);
  // Headquarters items (P159) → their coordinates.
  const hqIds = new Set<string>();
  for (const e of companyEntities.values()) {
    const id = claims(e, 'P159').map(itemId).find(Boolean);
    if (id) hqIds.add(id);
  }
  const hqEntities = await entities([...hqIds]);

  const shortCounts = new Map<string, number>();
  for (const c of todo) shortCounts.set(shortNameOf(c.name), (shortCounts.get(shortNameOf(c.name)) ?? 0) + 1);

  const out: Company[] = [];
  let wdCap = 0;
  let wdHq = 0;
  for (const c of todo) {
    const sector = SectorSchema.safeParse(c.sector);
    if (!sector.success) {
      console.warn(`  ${c.ticker}: unknown sector ${c.sector}`);
      continue;
    }
    const e = companyEntities.get(qid.get(c.ticker) ?? '');
    const fallback = parseHq(c.hqLocation);
    let hq = fallback;
    const hqItem = e ? claims(e, 'P159').map(itemId).find(Boolean) : undefined;
    const at = (hqItem && hqEntities.get(hqItem) && coordOf(hqEntities.get(hqItem)!)) || (e && coordOf(e));
    if (at && fallback) {
      hq = { ...fallback, lat: at.latitude, lng: at.longitude };
      wdHq++;
    }
    if (!hq) {
      console.warn(`  ${c.ticker}: can't place HQ "${c.hqLocation}"`);
      continue;
    }
    // Market cap in USD (Q4917) only; other currencies aren't converted.
    const cap = e ? latestQuantity(e, 'P2226', 'Q4917') : null;
    const employees = e ? latestQuantity(e, 'P1128') : null;
    if (cap) wdCap++;

    const shortName = shortNameOf(c.name);
    const aliases = [c.name];
    if (shortName !== c.name && (shortName.includes(' ') || !COMMON_WORDS.has(shortName)) && shortCounts.get(shortName) === 1) {
      aliases.unshift(shortName);
    }
    out.push({
      id: c.ticker,
      ticker: c.ticker,
      name: c.name.endsWith('(The)') ? `The ${c.name.replace(/\s*\(The\)$/, '')}` : c.name,
      shortName,
      sector: sector.data,
      industry: c.industry,
      hq,
      marketCap: cap ? Math.round((cap.amount / 1e9) * 10) / 10 : 0,
      marketCapSource: cap ? 'wikidata' : 'unknown',
      marketCapAsOf: cap?.time || null,
      employees: employees ? Math.round(employees.amount) : null,
      universe: 'SP500',
      cik: c.cik,
      aliases,
    });
  }
  writeJson(resolve(SCRAPED_DIR, 'companies.auto.json'), out);
  console.log(`✓ Universe: ${out.length} generated companies (${wdHq} HQs and ${wdCap} market caps from Wikidata)`);
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const i = process.argv.indexOf('--limit');
  const limit = i > 0 ? Number(process.argv[i + 1]) : Infinity;
  if (!existsSync(resolve(SCRAPED_DIR, 'sp500.json'))) throw new Error('Run the constituents step first (scrape:sp500).');
  buildUniverse(Number.isFinite(limit) ? limit : Infinity);
}
