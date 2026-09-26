/**
 * Step 2 — Mine each company's latest 10-K on SEC EDGAR for mentions of other companies
 * in the universe, and classify the sentence into a candidate relationship.
 *
 * Output: data/scraped/edgar-relationships.json (RawRelationship[])
 *
 * This is deliberately conservative: case-sensitive whole-word alias matching, one
 * sentence of context, low default confidence. Curated relationships always win on merge.
 */
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import * as cheerio from 'cheerio';
import type { RawRelationship } from '../../src/data/normalize';
import { loadUniverse, readJson, SCRAPED_DIR, secFetch, writeJson } from './lib';
import type { Constituent } from './sp500';

interface Submissions {
  filings: { recent: { form: string[]; accessionNumber: string[]; primaryDocument: string[]; filingDate: string[] } };
}

// Order matters: the first matching rule classifies the sentence.
const RULES: { type: RawRelationship['type']; re: RegExp; weight: number }[] = [
  { type: 'competitor', re: /\b(competitors?|compete[sd]? (with|against)|competing with)\b/i, weight: 0.3 },
  { type: 'customer', re: /\b(our|its) (largest|significant|major|key) customers?\b|\bcustomers? (such as|including)\b|\baccounted for \d+%/i, weight: 0.4 },
  { type: 'supplier', re: /\b(supplier|suppliers|foundr(y|ies)|contract manufactur\w*|sole source|single source|we (rely|depend) on)\b/i, weight: 0.4 },
  { type: 'investor', re: /\b(equity (interest|stake|investment)|invested in|ownership interest)\b/i, weight: 0.3 },
  { type: 'partner', re: /\b(partner(ship)?s?|collaborat\w*|alliance|joint venture|strategic agreement)\b/i, weight: 0.3 },
];

/** Short names that collide with product names or common words — require a fuller alias. */
const AMBIGUOUS = new Set(['RTX', 'Arm', 'Target', 'Intuitive', 'Chase', 'Meta', 'Visa', 'Citi', 'Uber', 'KLA', 'Ford']);
const MAX_EVIDENCE = 3;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function toSentences(html: string): string[] {
  const $ = cheerio.load(html);
  $('script, style, table').remove();
  const text = $('body').text().replace(/\s+/g, ' ');
  return text.split(/(?<=[.!?])\s+(?=[A-Z])/).filter((s) => s.length > 40 && s.length < 800);
}

async function latest10K(cik: string) {
  const body = await secFetch(`https://data.sec.gov/submissions/CIK${cik}.json`);
  if (!body) return null;
  const sub = JSON.parse(body) as Submissions;
  const r = sub.filings.recent;
  const i = r.form.findIndex((f) => f === '10-K' || f === '20-F');
  if (i < 0) return null;
  const acc = r.accessionNumber[i].replace(/-/g, '');
  return {
    url: `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${acc}/${r.primaryDocument[i]}`,
    date: r.filingDate[i],
    form: r.form[i],
  };
}

export async function scrapeEdgar(limit = Infinity): Promise<RawRelationship[]> {
  const companies = loadUniverse();
  const spPath = resolve(SCRAPED_DIR, 'sp500.json');
  const sp = existsSync(spPath) ? readJson<Constituent[]>(spPath) : [];
  const cikByTicker = new Map(sp.map((c) => [c.ticker, c.cik]));

  const matchers = companies.map((c) => ({
    id: c.id,
    re: new RegExp(
      `\\b(${[...new Set([c.name, c.shortName, ...c.aliases])]
        .filter((a) => !AMBIGUOUS.has(a))
        .map(escape)
        .join('|')})\\b`,
    ),
  }));

  const found: RawRelationship[] = [];
  const filers = companies.filter((c) => c.cik || (c.ticker && cikByTicker.has(c.ticker))).slice(0, limit);
  for (const filer of filers) {
    const cik = filer.cik ?? cikByTicker.get(filer.ticker!)!;
    try {
      const doc = await latest10K(cik);
      if (!doc) continue;
      const html = await secFetch(doc.url);
      if (!html) continue;
      const sentences = toSentences(html);
      let n = 0;
      for (const sentence of sentences) {
        for (const m of matchers) {
          if (m.id === filer.id || !m.re.test(sentence)) continue;
          const rule = RULES.find((r) => r.re.test(sentence));
          if (!rule) continue;
          // "supplier" sentences name the supplier → mention supplies filer.
          // "customer" sentences name the customer → normalized to filer supplies mention.
          const [source, target] = rule.type === 'supplier' ? [m.id, filer.id] : [filer.id, m.id];
          const type = rule.type === 'customer' ? 'customer' : rule.type;
          found.push({
            source: type === 'customer' ? m.id : source,
            target: type === 'customer' ? filer.id : target,
            type,
            weight: rule.weight,
            confidence: 0.45,
            evidence: [{ kind: 'filing', url: doc.url, note: sentence.slice(0, 280), date: doc.date }],
          });
          n++;
        }
      }
      console.log(`  ${filer.id.padEnd(10)} ${doc.form} ${doc.date}  ${n} mentions`);
    } catch (err) {
      console.warn(`  ${filer.id}: ${(err as Error).message}`);
    }
  }
  // Collapse repeated mentions of the same pair/type, keeping a few evidence sentences.
  const byKey = new Map<string, RawRelationship>();
  for (const r of found) {
    const key = `${r.source}|${r.type}|${r.target}`;
    const hit = byKey.get(key);
    if (!hit) byKey.set(key, r);
    else if (hit.evidence.length < MAX_EVIDENCE) hit.evidence.push(...r.evidence);
  }
  found.length = 0;
  found.push(...byKey.values());
  writeJson(resolve(SCRAPED_DIR, 'edgar-relationships.json'), found);
  console.log(`✓ EDGAR: ${found.length} candidate relationships from ${filers.length} filers`);
  return found;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const limit = Number(process.argv[2] ?? Infinity);
  scrapeEdgar(Number.isFinite(limit) ? limit : Infinity);
}
