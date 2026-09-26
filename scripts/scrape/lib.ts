import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import type { Company } from '../../src/data/schema';

export const ROOT = resolve(import.meta.dirname, '../..');
export const CACHE_DIR = resolve(ROOT, 'data/cache');
export const SEED_DIR = resolve(ROOT, 'data/seed');
export const SCRAPED_DIR = resolve(ROOT, 'data/scraped');
export const ENRICHED_DIR = resolve(ROOT, 'data/enriched');
/** Files the user downloads by hand from sec.gov (companyfacts, N-PORT datasets). Gitignored. */
export const BULK_DIR = resolve(ROOT, 'data/bulk');
export const OUT_FILE = resolve(ROOT, 'public/data/dataset.json');

/**
 * SEC requires a descriptive User-Agent with contact info.
 * Set SEC_USER_AGENT="RelationshipViz you@example.com" before scraping EDGAR.
 */
export const USER_AGENT = process.env.SEC_USER_AGENT ?? 'RelationshipViz research-bot (set SEC_USER_AGENT)';

/**
 * Without SEC_USER_AGENT the pipeline never makes automated SEC requests: it reads the on-disk
 * cache (at any age) and the manual bulk downloads in data/bulk/ only.
 */
export const SEC_ONLINE = !!process.env.SEC_USER_AGENT;

/** Wikimedia asks for a descriptive User-Agent too. */
export const WIKI_USER_AGENT =
  process.env.WIKI_USER_AGENT ?? 'RelationshipViz/0.1 (company relationship research; set WIKI_USER_AGENT)';

export const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;
export function writeJson(path: string, data: unknown) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Minimal rate limiter: at most `perSecond` requests per second, process-wide. */
let last = 0;
async function throttle(perSecond: number) {
  const gap = 1000 / perSecond;
  const wait = last + gap - Date.now();
  if (wait > 0) await sleep(wait);
  last = Date.now();
}

/** Fetch with on-disk cache so pipeline re-runs are cheap and polite. */
export async function cachedFetch(
  url: string,
  opts: { perSecond?: number; maxAgeHours?: number; userAgent?: string } = {},
): Promise<string> {
  const key = createHash('sha1').update(url).digest('hex');
  const file = resolve(CACHE_DIR, `${key}.txt`);
  const maxAge = (opts.maxAgeHours ?? 24 * 7) * 3600_000;
  if (existsSync(file)) {
    const { fetchedAt, body } = readJson<{ fetchedAt: number; body: string }>(file);
    if (Date.now() - fetchedAt < maxAge) return body;
  }
  let res: Response | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    await throttle(opts.perSecond ?? 8);
    res = await fetch(url, { headers: { 'User-Agent': opts.userAgent ?? USER_AGENT, 'Accept-Encoding': 'gzip, deflate' } });
    if (res.status !== 429 && res.status < 500) break;
    // Back off politely: honor Retry-After, else exponential.
    const retryAfter = Number(res.headers.get('retry-after'));
    await sleep((Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 2 ** attempt * 2) * 1000);
  }
  if (!res || !res.ok) throw new Error(`${res?.status} ${res?.statusText} — ${url}`);
  const body = await res.text();
  writeJson(file, { fetchedAt: Date.now(), url, body });
  return body;
}

/** Read a URL from the cache regardless of age; null when it was never fetched. */
export function cachedOnly(url: string): string | null {
  const file = resolve(CACHE_DIR, `${createHash('sha1').update(url).digest('hex')}.txt`);
  return existsSync(file) ? readJson<{ body: string }>(file).body : null;
}

/** SEC fetch that respects SEC_ONLINE: live (cached) when a User-Agent is set, cache-only otherwise. */
export async function secFetch(url: string, maxAgeHours?: number): Promise<string | null> {
  if (SEC_ONLINE) return cachedFetch(url, { maxAgeHours });
  return cachedOnly(url);
}

/** Seed companies (hand-curated, always win) plus generated S&P 500 companies. */
export function loadUniverse(): Company[] {
  const seed = readJson<Company[]>(resolve(SEED_DIR, 'companies.json'));
  const autoPath = resolve(SCRAPED_DIR, 'companies.auto.json');
  if (!existsSync(autoPath)) return seed;
  const ids = new Set(seed.map((c) => c.id));
  const tickers = new Set(seed.map((c) => c.ticker).filter(Boolean));
  const auto = readJson<Company[]>(autoPath).filter((c) => !ids.has(c.id) && !tickers.has(c.ticker));
  return [...seed, ...auto];
}
