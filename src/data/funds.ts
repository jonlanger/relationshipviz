/**
 * Mutual fund / ETF holdings: schema, SEC N-PORT dataset parsing, and mapping to companies.
 *
 * Holdings come from SEC's quarterly "Form N-PORT data sets" (tab-separated files), which the
 * user downloads by hand into data/bulk/nport/. Parsing is pure and line-based so the pipeline
 * can stream multi-gigabyte files and tests can feed small fixtures.
 */
import { z } from 'zod';
import type { Company } from './schema';
import { normalizeName } from '../lib/names';

export const FundSchema = z.object({
  /** Share-class ticker the user knows (VOO, VFIAX, …). */
  ticker: z.string(),
  name: z.string(),
  kind: z.enum(['etf', 'mutual']),
  seriesId: z.string().nullable(),
  /** Period the holdings describe, YYYY-MM-DD. */
  asOf: z.string().nullable(),
  filingUrl: z.string().url().nullable(),
  netAssetsUsdB: z.number().nullable(),
  /** Holdings mapped to companies in the dataset, as share of net assets (0–1). */
  holdings: z.array(z.object({ id: z.string(), weight: z.number() })),
  /** Share of net assets in holdings we couldn't map (non-S&P companies, bonds, cash, …). */
  unmappedWeight: z.number(),
  topUnmapped: z.array(z.object({ name: z.string(), weight: z.number() })).default([]),
  /** Why holdings are missing, e.g. unit investment trusts don't file N-PORT. */
  unavailable: z.string().nullable().default(null),
  /** Suggested alternative with published holdings. */
  alternative: z.string().nullable().default(null),
});
export type Fund = z.infer<typeof FundSchema>;

export const FundsFileSchema = z.object({ generatedAt: z.string(), source: z.string(), funds: z.array(FundSchema) });
export type FundsFile = z.infer<typeof FundsFileSchema>;

/** A seed entry: which funds to publish. */
export interface FundSeed {
  ticker: string;
  name: string;
  kind: 'etf' | 'mutual';
  /** N-PORT SERIES_ID when known; otherwise the series is matched by `seriesName`. */
  seriesId?: string;
  seriesName?: string;
  unavailable?: string;
  alternative?: string;
}

// ---------- TSV parsing ----------

/** Split a TSV header and return a column-index lookup that tolerates case and spacing differences. */
export function tsvColumns(header: string, wanted: Record<string, string[]>): Record<string, number> {
  const cols = header.split('\t').map((h) => h.trim().toUpperCase());
  const out: Record<string, number> = {};
  for (const [key, candidates] of Object.entries(wanted)) {
    const i = candidates.map((c) => cols.indexOf(c.toUpperCase())).find((x) => x >= 0);
    if (i == null) throw new Error(`N-PORT file is missing column ${candidates.join(' / ')}. Header: ${cols.slice(0, 12).join(', ')}…`);
    out[key] = i;
  }
  return out;
}

export interface RawHolding {
  accession: string;
  holdingId: string;
  name: string;
  title: string;
  cusip: string | null;
  /** Share of the fund's net assets, 0–1. */
  pct: number;
}

export const HOLDING_COLUMNS = {
  accession: ['ACCESSION_NUMBER'],
  holdingId: ['HOLDING_ID'],
  name: ['ISSUER_NAME'],
  title: ['ISSUER_TITLE'],
  cusip: ['ISSUER_CUSIP'],
  pct: ['PERCENTAGE'],
};

/** One FUND_REPORTED_HOLDING row → a holding, or null when it's for a fund we don't want. */
export function parseHoldingRow(line: string, col: Record<string, number>, accessions: Set<string>): RawHolding | null {
  const f = line.split('\t');
  const accession = f[col.accession];
  if (!accessions.has(accession)) return null;
  const pct = Number(f[col.pct]);
  const cusip = (f[col.cusip] ?? '').trim();
  return {
    accession,
    holdingId: f[col.holdingId],
    name: (f[col.name] ?? '').trim(),
    title: (f[col.title] ?? '').trim(),
    cusip: /^[0-9A-Z]{9}$/.test(cusip) && cusip !== '000000000' ? cusip : null,
    // N-PORT reports percentage of net assets as a percent (e.g. 7.12).
    pct: Number.isFinite(pct) ? pct / 100 : 0,
  };
}

// ---------- Mapping holdings to companies ----------

export interface Matcher {
  byTicker: Map<string, string>;
  byName: Map<string, string>;
  byCusip: Map<string, string>;
}

const tickerKey = (t: string) => t.toUpperCase().replace(/[/.\s-]/g, '');

export function buildMatcher(companies: Company[], cusipCache: Record<string, string> = {}): Matcher {
  const byTicker = new Map<string, string>();
  const byName = new Map<string, string>();
  for (const c of companies) {
    if (c.ticker) byTicker.set(tickerKey(c.ticker), c.id);
    for (const n of [c.name, c.shortName, ...c.aliases]) {
      const k = normalizeName(n);
      if (k.length >= 3 && !byName.has(k)) byName.set(k, c.id);
    }
  }
  // Dual share classes (Alphabet A/C, Fox, News Corp) map to the one company record.
  for (const [alt, main] of [['GOOG', 'GOOGL'], ['FOX', 'FOXA'], ['NWS', 'NWSA'], ['BRKA', 'BRKB']] as const) {
    const id = byTicker.get(main);
    if (id && !byTicker.has(alt)) byTicker.set(alt, id);
  }
  return { byTicker, byName, byCusip: new Map(Object.entries(cusipCache)) };
}

/** Company id for a holding: CUSIP (learned), then ticker, then normalized issuer name. */
export function matchHolding(h: { name: string; cusip: string | null; ticker?: string | null }, m: Matcher): string | null {
  if (h.cusip && m.byCusip.has(h.cusip)) return m.byCusip.get(h.cusip)!;
  if (h.ticker) {
    const id = m.byTicker.get(tickerKey(h.ticker));
    if (id) return id;
  }
  return m.byName.get(normalizeName(h.name)) ?? null;
}

/** Roll a fund's raw holdings up to company weights. Returns mapped holdings and what didn't map. */
export function mapHoldings(raw: (RawHolding & { ticker?: string | null })[], m: Matcher) {
  const weights = new Map<string, number>();
  const unmapped = new Map<string, number>();
  const learned: Record<string, string> = {};
  for (const h of raw) {
    if (h.pct <= 0) continue;
    const id = matchHolding(h, m);
    if (id) {
      weights.set(id, (weights.get(id) ?? 0) + h.pct);
      if (h.cusip && !m.byCusip.has(h.cusip)) learned[h.cusip] = id;
    } else {
      unmapped.set(h.name, (unmapped.get(h.name) ?? 0) + h.pct);
    }
  }
  const holdings = [...weights].map(([id, weight]) => ({ id, weight })).sort((a, b) => b.weight - a.weight);
  const unmappedWeight = [...unmapped.values()].reduce((a, b) => a + b, 0);
  const topUnmapped = [...unmapped].map(([name, weight]) => ({ name, weight })).sort((a, b) => b.weight - a.weight).slice(0, 8);
  return { holdings, unmappedWeight, topUnmapped, learned };
}
