/**
 * Annual financials from SEC XBRL "company facts" (10-K and 20-F filers).
 * Output: data/scraped/financials.json  { [companyId]: Financials }
 *
 * Companies switch XBRL tags over time, so each metric has an ordered list of candidate
 * concepts and we pick, per fiscal year, the first concept that reports a value.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Company, Financials, FiscalYear } from '../../src/data/schema';
import { BULK_DIR, loadUniverse, readJson, SCRAPED_DIR, secFetch, writeJson } from './lib';
import type { Constituent } from './sp500';

type Metric = 'revenue' | 'netIncome' | 'rnd' | 'epsDiluted' | 'dividendsPerShare';

const CONCEPTS: Record<Metric, string[]> = {
  revenue: [
    'us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax',
    'us-gaap:Revenues',
    'us-gaap:SalesRevenueNet',
    'us-gaap:RevenuesNetOfInterestExpense',
    'us-gaap:RevenueFromContractWithCustomerIncludingAssessedTax',
    'ifrs-full:Revenue',
    'ifrs-full:RevenueFromContractsWithCustomers',
  ],
  netIncome: [
    'us-gaap:NetIncomeLoss',
    'us-gaap:ProfitLoss',
    'us-gaap:NetIncomeLossAvailableToCommonStockholdersBasic',
    'ifrs-full:ProfitLossAttributableToOwnersOfParent',
    'ifrs-full:ProfitLoss',
  ],
  rnd: [
    'us-gaap:ResearchAndDevelopmentExpense',
    'us-gaap:ResearchAndDevelopmentExpenseExcludingAcquiredInProcessCost',
    'ifrs-full:ResearchAndDevelopmentExpense',
  ],
  epsDiluted: ['us-gaap:EarningsPerShareDiluted', 'ifrs-full:DilutedEarningsLossPerShare'],
  dividendsPerShare: ['us-gaap:CommonStockDividendsPerShareDeclared', 'us-gaap:CommonStockDividendsPerShareCashPaid'],
};

/** Per-share concepts are reported in e.g. "USD/shares"; the rest in plain currency units. */
const PER_SHARE: ReadonlySet<Metric> = new Set(['epsDiluted', 'dividendsPerShare']);

interface Fact {
  start?: string;
  end: string;
  val: number;
  form: string;
  fp?: string;
  filed: string;
}
interface CompanyFacts {
  facts: Record<string, Record<string, { units: Record<string, Fact[]> }>>;
}

const YEARS = 6;
const days = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 86_400_000;

/** Full-year values keyed by period end, latest filing wins (captures restatements). */
function annualSeries(
  facts: CompanyFacts,
  concept: string,
): { currency: string; byEnd: Map<string, number> } | null {
  const [ns, name] = concept.split(':');
  const units = facts.facts[ns]?.[name]?.units;
  if (!units) return null;
  const [currency, list] = Object.entries(units)[0] ?? [];
  if (!currency || !list) return null;
  const byEnd = new Map<string, { val: number; filed: string }>();
  for (const f of list) {
    if (!/^(10-K|20-F|40-F)/.test(f.form) || !f.start) continue;
    const d = days(f.start, f.end);
    if (d < 340 || d > 390) continue;
    const prev = byEnd.get(f.end);
    if (!prev || f.filed > prev.filed) byEnd.set(f.end, { val: f.val, filed: f.filed });
  }
  return { currency, byEnd: new Map([...byEnd].map(([k, v]) => [k, v.val])) };
}

export async function scrapeFinancials() {
  const companies = loadUniverse();
  const spPath = resolve(SCRAPED_DIR, 'sp500.json');
  const sp = existsSync(spPath) ? readJson<Constituent[]>(spPath) : [];
  const wikiCik = new Map(sp.map((c) => [c.ticker, c.cik]));
  // SEC's ticker map covers foreign ADR filers (TSM, ASML, SONY, …) too.
  const tickerJson =
    (await secFetch('https://www.sec.gov/files/company_tickers.json', 24 * 7)) ??
    (existsSync(resolve(BULK_DIR, 'company_tickers.json')) ? readFileSync(resolve(BULK_DIR, 'company_tickers.json'), 'utf8') : '{}');
  const tickers = JSON.parse(tickerJson) as Record<string, { cik_str: number; ticker: string }>;
  const secCik = new Map(
    Object.values(tickers).map((t) => [t.ticker, String(t.cik_str).padStart(10, '0')]),
  );
  // A company can have several CIKs (e.g. after a holding-company reorganization); try each until one has history.
  const candidates = (c: Company) => {
    const t = c.ticker;
    const list = [
      c.cik,
      t && wikiCik.get(t),
      t && secCik.get(t),
      t && secCik.get(t.replace('.', '-')),
    ];
    return [...new Set(list.filter((x): x is string => !!x))];
  };

  const out: Record<string, Financials> = {};
  for (const c of companies) {
    for (const cik of candidates(c)) {
      const url = `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`;
      // Manual bulk download (companyfacts.zip, unzipped) first, then the API or its cache.
      const bulk = resolve(BULK_DIR, 'companyfacts', `CIK${cik}.json`);
      try {
        const body = existsSync(bulk) ? readFileSync(bulk, 'utf8') : await secFetch(url);
        if (!body) continue;
        const facts = JSON.parse(body) as CompanyFacts;
        const series: Record<Metric, { currency: string; byEnd: Map<string, number> }[]> = {
          revenue: [],
          netIncome: [],
          rnd: [],
          epsDiluted: [],
          dividendsPerShare: [],
        };
        for (const m of Object.keys(CONCEPTS) as Metric[]) {
          for (const concept of CONCEPTS[m]) {
            const s = annualSeries(facts, concept);
            if (s) series[m].push(s);
          }
        }
        const currency = series.revenue[0]?.currency ?? series.netIncome[0]?.currency;
        if (!currency) continue;
        const ends = new Set<string>();
        for (const s of [...series.revenue, ...series.netIncome])
          if (s.currency === currency) s.byEnd.forEach((_, e) => ends.add(e));
        const pick = (m: Metric, end: string) => {
          const unit = PER_SHARE.has(m) ? `${currency}/shares` : currency;
          for (const s of series[m])
            if (s.currency === unit && s.byEnd.has(end)) return s.byEnd.get(end)!;
          return null;
        };
        const annual: FiscalYear[] = [...ends]
          .sort()
          .slice(-YEARS)
          .map((end) => ({
            fiscalYear: Number(end.slice(0, 4)),
            end,
            revenue: pick('revenue', end),
            netIncome: pick('netIncome', end),
            rnd: pick('rnd', end),
            epsDiluted: pick('epsDiluted', end),
            dividendsPerShare: pick('dividendsPerShare', end),
          }))
          .filter((y) => y.revenue != null || y.netIncome != null);
        if (annual.length >= 2) {
          out[c.id] = { currency, source: 'sec-xbrl', sourceUrl: url, annual };
          break;
        }
      } catch (err) {
        console.warn(`  ${c.id} (CIK ${cik}): ${(err as Error).message}`);
      }
    }
  }
  writeJson(resolve(SCRAPED_DIR, 'financials.json'), out);
  console.log(`✓ Financials: ${Object.keys(out).length}/${companies.length} companies`);
}

if (import.meta.url === `file://${process.argv[1]}`) scrapeFinancials();
