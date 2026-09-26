import { useMemo } from 'react';
import { BookOpen, Database, FileSearch, GitMerge, ShieldCheck, Sparkles } from 'lucide-react';
import { useAppStore } from '@/app/store';
import { UNIVERSES } from '@/data/schema';
import { COUNTRY_RISK } from '@/data/countryRisk';
import { FACTOR_META, OPPORTUNITY_FACTORS, RISK_FACTORS, STANCE_META, type Stance } from '@/data/lenses';
import { STANCE_TONE } from '@/lib/colors';
import { LIMITS } from '@/data/portfolio';
import { DAMPING, MAX_HOPS } from '@/data/scenarios';
import { SCENARIO_PRESETS } from '@/data/scenarioPresets';
import { GOAL_WEIGHTS, RISK_TOLERANCE, SIGNAL_LABEL } from '@/data/ideas';
import { THEMES } from '@/data/themes';
import { formatNumber } from '@/lib/format';
import { Badge, Heading, Icon, Text } from '@/components/atoms';
import { StatTile } from '@/components/molecules';
import styles from './AboutDataPage.module.css';

const STEPS = [
  { icon: Database, title: 'Constituents', body: 'The S&P 500 list (ticker, GICS sector, HQ, SEC CIK) is scraped from Wikipedia and refreshed on each pipeline run.' },
  { icon: FileSearch, title: 'Filing mining', body: 'Each company’s latest 10-K (or 20-F) on SEC EDGAR is scanned for mentions of other companies. The surrounding sentence is classified as supplier, customer, competitor, partner or investor.' },
  { icon: BookOpen, title: 'Profiles & financials', body: 'Company descriptions come from Wikipedia and structured facts (CEO, founders, subsidiaries) from Wikidata. Annual revenue, net income and R&D come from SEC XBRL filings.' },
  { icon: Sparkles, title: 'Relationship research', body: 'Key relationships are researched on the web: what flows between the companies, how material it is, when it started, and what changed, all with cited sources. Hand-verified research is marked Verified; AI-researched links are marked unreviewed.' },
  { icon: GitMerge, title: 'Merge', body: 'Scraped links are merged with a hand-curated seed. Curated entries win on conflict; filing excerpts are attached as extra evidence. Customer links are flipped into supplier links so direction is consistent.' },
  { icon: ShieldCheck, title: 'Validate', body: 'The merged dataset is validated against a strict schema (unknown companies, duplicates and self-loops are rejected) before it’s published to the app.' },
];

export function AboutDataPage() {
  const dataset = useAppStore((s) => s.dataset)!;
  const stats = useMemo(() => {
    const kinds = { curated: 0, filing: 0, press: 0, research: 0 };
    for (const r of dataset.relationships) for (const k of new Set(r.evidence.map((e) => e.kind))) kinds[k]++;
    const byUniverse = UNIVERSES.map((u) => [u, dataset.companies.filter((c) => c.universe === u).length] as const);
    return { kinds, byUniverse };
  }, [dataset]);

  return (
    <main className={styles.page}>
      <article className={styles.inner}>
        <header className={styles.header}>
          <Text variant="overline" tone="accent">Data</Text>
          <Heading level="display">Sources & methodology</Heading>
          <Text as="p" variant="bodyLg" tone="secondary">
            RelationshipViz maps how companies work with each other: who supplies whom, who invests in whom, who partners and who competes. Here’s where that data comes from and how much to trust it.
          </Text>
        </header>

        <div className={styles.stats}>
          <StatTile label="Companies" value={formatNumber(dataset.companies.length)} caption={stats.byUniverse.map(([u, n]) => `${n} ${u === 'SP500' ? 'S&P 500' : u.toLowerCase()}`).join(' · ')} />
          <StatTile label="Relationships" value={formatNumber(dataset.relationships.length)} caption={`${stats.kinds.curated} curated · ${stats.kinds.filing} with filing evidence`} />
          <StatTile label="Generated" value={new Date(dataset.generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} caption={`Figures as of ${dataset.asOf} · v${dataset.version}`} />
        </div>

        <section className={styles.section}>
          <Heading level="h1" as="h2">Pipeline</Heading>
          <ol className={styles.steps}>
            {STEPS.map((s, i) => (
              <li key={s.title} className={styles.step}>
                <span className={styles.stepIcon}><Icon icon={s.icon} /></span>
                <div>
                  <Text variant="caption" tone="tertiary" mono>0{i + 1}</Text>
                  <Heading level="h3">{s.title}</Heading>
                  <Text as="p" variant="bodySm" tone="secondary">{s.body}</Text>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.section}>
          <Heading level="h1" as="h2">Reading the data</Heading>
          <dl className={styles.defs}>
            <dt><Badge tone="accent">Curated</Badge></dt>
            <dd>Well-documented relationships summarized in our own words from public reporting (annual reports, investor relations, major press). Links point to the company’s filings or IR page so you can verify.</dd>
            <dt><Badge>SEC filing</Badge></dt>
            <dd>Machine-extracted from 10-K text, with the source sentence quoted. Useful for discovery but noisy, so it’s hidden by default (below the 50% confidence threshold in Explore).</dd>
            <dt><Badge tone="good">Verified research</Badge></dt>
            <dd>Relationship detail (what flows, materiality, timeline) researched on the web and checked by hand, with cited sources.</dd>
            <dt><Badge tone="warning">AI-researched</Badge></dt>
            <dd>Detail produced by the automated research step (Claude with web search). Sources are cited but not yet reviewed by a person.</dd>
            <dt><Text weight="semibold">Strength</Text></dt>
            <dd>0–1 estimate of how important the tie is to the pair: revenue dependence, sole-source supply, size of stake. It drives edge thickness and Sankey width.</dd>
            <dt><Text weight="semibold">Confidence</Text></dt>
            <dd>0–1 estimate that the relationship exists as described. Curated links are 60–90%; scraped links start at 45%.</dd>
            <dt><Text weight="semibold">Betweenness</Text></dt>
            <dd>Share of shortest paths between other companies that pass through a company, a common measure of how much a company bridges the network.</dd>
          </dl>
        </section>

        <section className={styles.section} id="lenses">
          <Heading level="h1" as="h2">Risk & opportunity lenses</Heading>
          <Text as="p" variant="body" tone="secondary">
            The Lenses page and the graph’s Lens control score each company for an equity holder deciding where to put more money and where to trim. Every score is a transparent rule over data already shown in the app: relationship strength, direction, disclosed revenue shares, deal values, status and events, headquarters, betweenness, and SEC financials. Nothing is fetched live, and no model makes a judgment call.
          </Text>
          <ul className={styles.list}>
            <li>Each factor produces a raw value per company. That value becomes a percentile among the companies in view (or all companies on a profile), so scores are relative, not absolute.</li>
            <li>A company’s score (0–100) is the weighted average of its factor percentiles. You can change the weights on the Lenses page.</li>
            <li>When a factor has no data, or doesn’t apply (a private company without SEC financials, or customer concentration for a company with no mapped customers), it counts as the median. Thin data pulls a score toward the middle instead of letting one factor decide it. Scores where less than half the weight had real data are marked “Limited data”.</li>
            <li>Every factor attributes its value to the relationships behind it. Those are the “biggest exposures” and “tailwinds” on each scorecard and the tinted links in the graph.</li>
          </ul>
          <div className={styles.factorGrid}>
            {([['Risk', RISK_FACTORS], ['Opportunity', OPPORTUNITY_FACTORS]] as const).map(([title, keys]) => (
              <div key={title}>
                <Heading level="h3">{title} factors</Heading>
                <dl className={styles.defs}>
                  {keys.map((k) => (
                    <div key={k} className={styles.defRow}>
                      <dt><Text weight="semibold" variant="bodySm">{FACTOR_META[k].label}</Text></dt>
                      <dd>{FACTOR_META[k].description}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
          <Heading level="h3">Stance</Heading>
          <dl className={styles.defs}>
            {(['add', 'watch', 'reduce', 'hold'] as Stance[]).map((s) => (
              <div key={s} className={styles.defRow}>
                <dt><Badge tone={STANCE_TONE[s]} dot>{STANCE_META[s].label}</Badge></dt>
                <dd>{STANCE_META[s].description}</dd>
              </div>
            ))}
          </dl>
          <Text as="p" variant="bodySm" tone="secondary">
            Stances split the risk × opportunity quadrant at the median of each score, so about half the companies in view rank as “high” on each.
          </Text>
          <Heading level="h3">Jurisdiction tiers</Heading>
          <Text as="p" variant="bodySm" tone="secondary">
            Geographic exposure uses a coarse, editorial view of geopolitical, sanctions and export-control risk. Countries not listed count as low risk (0.1).
          </Text>
          <dl className={styles.defs}>
            {Object.entries(COUNTRY_RISK).map(([code, r]) => (
              <div key={code} className={styles.defRow}>
                <dt><Text weight="semibold" variant="bodySm">{code} · {r.tier} ({r.score})</Text></dt>
                <dd>{r.note}</dd>
              </div>
            ))}
          </dl>
          <Text as="p" variant="bodySm" tone="secondary">
            Known blind spots: the lenses only see relationships that are recorded here, so a company with few mapped ties looks less exposed than it may be. Valuation and share price aren’t considered. These are signals for research, not investment advice.
          </Text>
        </section>

        <section className={styles.section} id="scenarios">
          <Heading level="h1" as="h2">Stress tests</Heading>
          <Text as="p" variant="body" tone="secondary">
            A stress test hits a set of companies (named ones, or everyone in a country or sector) with a severity from 0 to 100%. The shock then travels along relationships for up to {MAX_HOPS} steps. Each step passes on a share of the shock equal to how material the link is to the company receiving it, and steps after the first are damped by {Math.round(DAMPING * 100)}%.
          </Text>
          <ul className={styles.list}>
            <li><strong>Can’t deliver</strong> (disruption): customers lose supply in proportion to how much they depend on the shocked company, and suppliers lose a customer.</li>
            <li><strong>Spends less</strong> (demand): only suppliers are hit, in proportion to how much of their business the shocked company is.</li>
            <li>Partners, owners and investors feel a smaller share. Competitors of directly shocked companies are listed as possible beneficiaries.</li>
            <li>Every impact keeps its strongest path, so you can see which link carries it. These are exposure maps, not price or earnings forecasts; the preset severities are round numbers.</li>
          </ul>
          <dl className={styles.defs}>
            {SCENARIO_PRESETS.map((p) => (
              <div key={p.id} className={styles.defRow}>
                <dt><Text weight="semibold" variant="bodySm">{p.label}</Text></dt>
                <dd>{p.description}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className={styles.section} id="portfolio">
          <Heading level="h1" as="h2">Portfolio look-through</Heading>
          <Text as="p" variant="body" tone="secondary">
            Positions you enter on the Portfolio page stay in your browser; nothing is uploaded. Funds are expanded into the companies they hold, using each fund’s latest holdings report to the SEC (Form N-PORT). Holdings outside this map (smaller companies, foreign stocks, bonds, cash) are counted as unmapped and not analyzed.
          </Text>
          <ul className={styles.list}>
            <li><strong>Hidden dependencies</strong>: for every supplier or customer your holdings rely on, the share of your portfolio with a material tie to it (strength ≥ {LIMITS.materialTie}).</li>
            <li><strong>Fund overlap</strong>: the share of holdings two funds have in common (the sum of the smaller weight for each shared company).</li>
            <li>
              <strong>Warnings</strong> when one company is above {Math.round(LIMITS.company * 100)}% of the portfolio, one sector above {Math.round(LIMITS.sector * 100)}%, holdings depending on one counterparty above {Math.round(LIMITS.dependency * 100)}%, a higher-risk jurisdiction above {Math.round(LIMITS.jurisdiction * 100)}%, or two funds sharing more than {Math.round(LIMITS.overlap * 100)}%.
            </li>
            <li>Unit investment trusts such as SPY, QQQ and DIA don’t file N-PORT, so their holdings aren’t available; funds tracking the same index are suggested instead.</li>
          </ul>
          <Text as="p" variant="bodySm" tone="secondary">
            Fund holdings are refreshed by hand from SEC’s quarterly bulk files, which avoids automated requests to SEC:
          </Text>
          <pre className={styles.code}><code>{`# 1. In your browser, download a quarter of "Form N-PORT Data Sets" from sec.gov
#    and unzip it into data/bulk/nport/
# 2. Optional: download "Bulk data > companyfacts.zip" and unzip into data/bulk/companyfacts/
#    (financials, EPS and dividends for every S&P 500 company)
npm run scrape:funds
npm run scrape:merge`}</code></pre>
        </section>

        <section className={styles.section} id="ideas">
          <Heading level="h1" as="h2">How ideas are ranked</Heading>
          <Text as="p" variant="body" tone="secondary">
            The idea finder is an educational screen. It ranks companies by how well they match your answers and never suggests amounts or tells you to buy or sell. Each company gets six signals from 0 to 1, and your goal sets how much each counts:
          </Text>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Goal</th>
                  {Object.values(SIGNAL_LABEL).map((l) => <th key={l} scope="col">{l}</th>)}
                </tr>
              </thead>
              <tbody>
                {Object.entries(GOAL_WEIGHTS).map(([goal, w]) => (
                  <tr key={goal}>
                    <th scope="row">{goal[0].toUpperCase() + goal.slice(1)}</th>
                    {(Object.keys(SIGNAL_LABEL) as (keyof typeof SIGNAL_LABEL)[]).map((k) => {
                      const v = w[k];
                      return <td key={k}>{v ? `{Math.round(v * 100)}%` : '—'}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className={styles.list}>
            <li><strong>Growth</strong>, <strong>Profitability</strong> and <strong>Steadiness</strong> rank revenue growth, net margin and the consistency of revenue and profits from SEC filings. <strong>Income</strong> uses dividends per share: whether it pays, how many years in a row it has raised, and whether the payout is covered by earnings.</li>
            <li><strong>Opportunity lens</strong> is the company’s Opportunity percentile. <strong>Theme fit</strong> is 1 for a theme’s core companies and ½ for their material suppliers and customers; picking themes limits results to them.</li>
            <li>
              Your comfort with swings sets the highest Risk-lens percentile accepted without a penalty: {Object.entries(RISK_TOLERANCE).map(([k, v]) => `${k} ${Math.round(v * 100)}`).join(', ')}. Shorter horizons lower it by 10 points.
            </li>
            <li>Exclusions are hard filters. If you’ve entered holdings, ideas you already hold or that add to an existing heavy dependency are marked down.</li>
            <li>Funds are ranked by the holdings-weighted fit of the companies they hold, plus how much of them fits your themes, minus overlap with what you hold.</li>
          </ul>
          <Text as="p" variant="bodySm" tone="secondary">Themes: {THEMES.map((t) => t.label).join(' · ')}.</Text>
          <Text as="p" variant="bodySm" tone="secondary">
            None of this is personalized investment advice. It doesn’t know your income, savings, taxes or goals beyond the answers you give, and we’re not a licensed adviser. Please talk to one before investing.
          </Text>
        </section>

        <section className={styles.section}>
          <Heading level="h1" as="h2">Limitations</Heading>
          <ul className={styles.list}>
            <li>Coverage starts with the largest S&P 500 companies plus the global and private counterparties they depend on most (e.g. TSMC, ASML, OpenAI). The full 500 and other indices are next.</li>
            <li>Market caps, valuations and headcounts are approximate snapshots, not live quotes.</li>
            <li>Absence of a link doesn’t mean absence of a relationship. Many supplier ties are never disclosed.</li>
            <li>Nothing here is investment advice.</li>
          </ul>
        </section>

        <section className={styles.section}>
          <Heading level="h1" as="h2">Refreshing the data</Heading>
          <pre className={styles.code}><code>{`# SEC asks for a descriptive User-Agent with contact info
SEC_USER_AGENT="RelationshipViz you@example.com" npm run scrape

# Research relationship detail with Claude (needs ANTHROPIC_API_KEY)
npm run enrich -- --limit 20

# Rebuild from the seed + cached scrapes only
npm run scrape:merge`}</code></pre>
        </section>
      </article>
    </main>
  );
}
