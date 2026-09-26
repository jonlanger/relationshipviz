/**
 * Step 4 — Fund holdings from SEC's quarterly Form N-PORT data sets (manual download).
 *
 * 1. Download a quarter's "Form N-PORT Data Sets" zip from sec.gov in your browser.
 * 2. Unzip it into data/bulk/nport/ (SUBMISSION.tsv, FUND_REPORTED_INFO.tsv, FUND_REPORTED_HOLDING.tsv, IDENTIFIERS.tsv, …).
 * 3. Optional: save sec.gov/files/company_tickers_mf.json into data/bulk/ to match funds by exact series id.
 * 4. npm run scrape:funds, then npm run scrape:merge.
 *
 * Output: public/data/funds.json. Without the bulk files, every fund is published as "holdings not loaded".
 */
import { createReadStream, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';
import {
  buildMatcher,
  FundsFileSchema,
  HOLDING_COLUMNS,
  mapHoldings,
  parseHoldingRow,
  tsvColumns,
  type Fund,
  type FundSeed,
  type RawHolding,
} from '../../src/data/funds';
import { normalizeName } from '../../src/lib/names';
import { BULK_DIR, loadUniverse, readJson, ROOT, SCRAPED_DIR, SEED_DIR, writeJson } from './lib';

const NPORT = resolve(BULK_DIR, 'nport');
const OUT = resolve(ROOT, 'public/data/funds.json');
const CUSIP_CACHE = resolve(SCRAPED_DIR, 'cusip-map.json');

async function* lines(file: string) {
  const rl = createInterface({ input: createReadStream(file), crlfDelay: Infinity });
  for await (const line of rl) yield line;
}

/** Read a whole (small) TSV into rows keyed by the wanted columns. */
async function readTsv(file: string, wanted: Record<string, string[]>) {
  const rows: Record<string, string>[] = [];
  let col: Record<string, number> | null = null;
  for await (const line of lines(file)) {
    if (!col) {
      col = tsvColumns(line, wanted);
      continue;
    }
    const f = line.split('\t');
    rows.push(Object.fromEntries(Object.entries(col).map(([k, i]) => [k, f[i] ?? ''])));
  }
  return rows;
}

const toTime = (d: string) => {
  const t = Date.parse(d);
  return Number.isFinite(t) ? t : 0;
};
const isoDate = (d: string) => {
  const t = toTime(d);
  return t ? new Date(t).toISOString().slice(0, 10) : null;
};

export async function scrapeFunds() {
  const seeds = readJson<FundSeed[]>(resolve(SEED_DIR, 'funds.json'));
  const companies = loadUniverse();
  const empty = (s: FundSeed, why: string): Fund => ({
    ticker: s.ticker, name: s.name, kind: s.kind, seriesId: s.seriesId ?? null, asOf: null, filingUrl: null, netAssetsUsdB: null,
    holdings: [], unmappedWeight: 0, topUnmapped: [], unavailable: s.unavailable ?? why, alternative: s.alternative ?? null,
  });

  const info = resolve(NPORT, 'FUND_REPORTED_INFO.tsv');
  if (!existsSync(info)) {
    const file = { generatedAt: new Date().toISOString(), source: 'none', funds: seeds.map((s) => empty(s, 'Holdings not loaded yet.')) };
    writeJson(OUT, FundsFileSchema.parse(file));
    console.log(`• Funds: no N-PORT data in ${NPORT}; published ${seeds.length} funds without holdings`);
    return;
  }

  // Series id for each ticker: seed → company_tickers_mf.json → series-name match.
  const mfPath = resolve(BULK_DIR, 'company_tickers_mf.json');
  const mf = new Map<string, string>();
  if (existsSync(mfPath)) {
    const j = JSON.parse(readFileSync(mfPath, 'utf8')) as { fields: string[]; data: (string | number)[][] };
    const si = j.fields.indexOf('seriesId');
    const ti = j.fields.indexOf('symbol');
    for (const row of j.data) mf.set(String(row[ti]).toUpperCase(), String(row[si]));
  }

  const infoRows = await readTsv(info, {
    accession: ['ACCESSION_NUMBER'],
    seriesId: ['SERIES_ID'],
    seriesName: ['SERIES_NAME'],
    netAssets: ['NET_ASSETS'],
  });
  const subRows = await readTsv(resolve(NPORT, 'SUBMISSION.tsv'), {
    accession: ['ACCESSION_NUMBER'],
    period: ['REPORT_ENDING_PERIOD', 'REPORT_DATE'],
  });
  const regPath = resolve(NPORT, 'REGISTRANT.tsv');
  const regRows = existsSync(regPath) ? await readTsv(regPath, { accession: ['ACCESSION_NUMBER'], cik: ['CIK'] }) : [];
  const period = new Map(subRows.map((r) => [r.accession, r.period]));
  const cikOf = new Map(regRows.map((r) => [r.accession, r.cik]));

  // Latest filing per series.
  const latest = new Map<string, (typeof infoRows)[number]>();
  for (const r of infoRows) {
    const prev = latest.get(r.seriesId);
    if (!prev || toTime(period.get(r.accession) ?? '') > toTime(period.get(prev.accession) ?? '')) latest.set(r.seriesId, r);
  }
  const byName = new Map<string, string>();
  for (const [sid, r] of latest) byName.set(normalizeName(r.seriesName), sid);

  const seriesFor = (s: FundSeed) =>
    s.seriesId ?? mf.get(s.ticker) ?? (s.seriesName ? byName.get(normalizeName(s.seriesName)) : undefined) ?? null;
  const wanted = new Map<string, string>(); // accession → series
  for (const s of seeds) {
    const sid = s.unavailable ? null : seriesFor(s);
    const row = sid ? latest.get(sid) : undefined;
    if (row) wanted.set(row.accession, sid!);
  }

  // Stream holdings for the wanted filings only, then their tickers.
  const raw = new Map<string, (RawHolding & { ticker?: string | null })[]>();
  let col: Record<string, number> | null = null;
  const accessions = new Set(wanted.keys());
  const holdingIds = new Map<string, RawHolding & { ticker?: string | null }>();
  for await (const line of lines(resolve(NPORT, 'FUND_REPORTED_HOLDING.tsv'))) {
    if (!col) {
      col = tsvColumns(line, HOLDING_COLUMNS);
      continue;
    }
    const h = parseHoldingRow(line, col, accessions);
    if (!h) continue;
    const list = raw.get(h.accession) ?? [];
    list.push(h);
    raw.set(h.accession, list);
    holdingIds.set(h.holdingId, h);
  }
  const idPath = resolve(NPORT, 'IDENTIFIERS.tsv');
  if (existsSync(idPath)) {
    let icol: Record<string, number> | null = null;
    for await (const line of lines(idPath)) {
      if (!icol) {
        icol = tsvColumns(line, { holdingId: ['HOLDING_ID'], ticker: ['IDENTIFIER_TICKER'] });
        continue;
      }
      const f = line.split('\t');
      const h = holdingIds.get(f[icol.holdingId]);
      if (h && f[icol.ticker]) h.ticker = f[icol.ticker].trim();
    }
  }

  const cusipCache = existsSync(CUSIP_CACHE) ? readJson<Record<string, string>>(CUSIP_CACHE) : {};
  const matcher = buildMatcher(companies, cusipCache);
  const funds: Fund[] = [];
  for (const s of seeds) {
    if (s.unavailable) {
      funds.push(empty(s, s.unavailable));
      continue;
    }
    const sid = seriesFor(s);
    const row = sid ? latest.get(sid) : undefined;
    if (!row) {
      funds.push(empty(s, 'Not found in this N-PORT dataset.'));
      continue;
    }
    const mapped = mapHoldings(raw.get(row.accession) ?? [], matcher);
    Object.assign(cusipCache, mapped.learned);
    for (const [k, v] of Object.entries(mapped.learned)) matcher.byCusip.set(k, v);
    const cik = cikOf.get(row.accession);
    funds.push({
      ticker: s.ticker,
      name: s.name,
      kind: s.kind,
      seriesId: sid,
      asOf: isoDate(period.get(row.accession) ?? ''),
      filingUrl: cik ? `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${row.accession.replace(/-/g, '')}/` : null,
      netAssetsUsdB: Number(row.netAssets) ? Math.round(Number(row.netAssets) / 1e8) / 10 : null,
      holdings: mapped.holdings,
      unmappedWeight: mapped.unmappedWeight,
      topUnmapped: mapped.topUnmapped,
      unavailable: null,
      alternative: null,
    });
    console.log(`  ${s.ticker.padEnd(6)} ${mapped.holdings.length} companies mapped, ${(100 * (1 - mapped.unmappedWeight)).toFixed(0)}% of assets`);
  }
  writeJson(CUSIP_CACHE, cusipCache);
  writeJson(OUT, FundsFileSchema.parse({ generatedAt: new Date().toISOString(), source: 'sec-nport', funds }));
  console.log(`✓ Funds: ${funds.filter((f) => f.holdings.length).length}/${funds.length} with holdings`);
}

if (import.meta.url === `file://${process.argv[1]}`) scrapeFunds();
