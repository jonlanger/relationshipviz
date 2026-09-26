/**
 * Step 1 — S&P 500 constituents from Wikipedia.
 * Output: data/scraped/sp500.json  [{ ticker, name, sector, industry, hqLocation, cik }]
 */
import * as cheerio from 'cheerio';
import { resolve } from 'node:path';
import { cachedFetch, SCRAPED_DIR, writeJson } from './lib';

const URL = 'https://en.wikipedia.org/wiki/List_of_S%26P_500_companies';

export interface Constituent {
  ticker: string;
  name: string;
  sector: string;
  industry: string;
  hqLocation: string;
  cik: string;
  /** Wikipedia article title for the company, from the table's link. */
  wikiTitle: string | null;
}

export async function scrapeSp500(): Promise<Constituent[]> {
  const html = await cachedFetch(URL, { maxAgeHours: 24 });
  const $ = cheerio.load(html);
  const rows = $('#constituents tbody tr').toArray();
  const out: Constituent[] = [];
  for (const row of rows) {
    const cells = $(row).find('td').toArray().map((td) => $(td).text().trim());
    if (cells.length < 7) continue;
    const [ticker, name, sector, industry, hqLocation, , cik] = cells;
    const href = $(row).find('td').eq(1).find('a').attr('href') ?? '';
    const m = href.match(/\/wiki\/([^#?]+)/);
    const wikiTitle = m ? decodeURIComponent(m[1]) : null;
    out.push({ ticker, name, sector, industry, hqLocation, cik: cik.padStart(10, '0'), wikiTitle });
  }
  if (out.length < 480) throw new Error(`Expected ~500 constituents, parsed ${out.length}. Page layout may have changed.`);
  writeJson(resolve(SCRAPED_DIR, 'sp500.json'), out);
  console.log(`✓ S&P 500: ${out.length} constituents`);
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) scrapeSp500();
