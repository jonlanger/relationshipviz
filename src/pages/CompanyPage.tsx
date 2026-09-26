import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Network, SearchX } from 'lucide-react';
import { useTheme } from '@/design-system';
import { useAppStore, useCompanyIndex } from '@/app/store';
import { companySupplyFlow, typeBreakdown } from '@/data/aggregates';
import { computeMetrics } from '@/data/metrics';
import { computeLenses } from '@/data/lenses';
import { sectorColor } from '@/lib/colors';
import { pairKey } from '@/data/graph';
import { capCaption, formatCompact, formatCompanyCap, formatDecimal, formatMoney } from '@/lib/format';
import { groupRelations } from '@/lib/relations';
import { Badge, Button, Heading, Icon, Sparkbars, Swatch, Text, TickerMark } from '@/components/atoms';
import { CompanyFacts, EmptyState, SectionHeader, StatTile } from '@/components/molecules';
import {
  ChartCard,
  DataTable,
  FinancialsChart,
  LensScorecard,
  RelationshipDetailView,
  RelationshipMix,
  SupplyFlowSankey,
} from '@/components/organisms';
import styles from './CompanyPage.module.css';

const UNIVERSE_LABEL = { SP500: 'S&P 500', GLOBAL: 'Global listed', PRIVATE: 'Private' } as const;

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

export function CompanyPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { tokens } = useTheme();
  const dataset = useAppStore((s) => s.dataset)!;
  const select = useAppStore((s) => s.select);
  const selectEdge = useAppStore((s) => s.selectEdge);
  const lensWeights = useAppStore((s) => s.lensWeights);
  const index = useCompanyIndex();
  const company = index.get(decodeURIComponent(id));

  // Profile shows every known relationship (including unverified ones), independent of Explore filters.
  const metrics = useMemo(() => computeMetrics(dataset.companies, dataset.relationships), [dataset]);
  const rels = useMemo(
    () => (company ? dataset.relationships.filter((r) => r.source === company.id || r.target === company.id) : []),
    [dataset, company],
  );
  const flow = useMemo(() => (company ? companySupplyFlow(company.id, dataset.companies, rels) : null), [company, dataset, rels]);
  const mix = useMemo(() => typeBreakdown(rels), [rels]);
  // Like the metrics, the profile ranks against every company, not just the filtered view.
  const lenses = useMemo(
    () => computeLenses(dataset.companies, dataset.relationships, metrics, lensWeights),
    [dataset, metrics, lensWeights],
  );

  if (!company) {
    return (
      <EmptyState
        icon={SearchX}
        title="Company not found"
        description={`There's no company with id “${id}” in this dataset.`}
        action={<Button onClick={() => navigate('/explore')}>Back to Explore</Button>}
      />
    );
  }

  const m = metrics.byId.get(company.id);
  const rank = m && m.betweenness > 0 ? [...metrics.byId.values()].filter((x) => x.betweenness > m.betweenness).length + 1 : null;
  const color = sectorColor(company.sector, tokens);
  const viewInGraph = (cid: string) => {
    select(cid);
    navigate('/explore');
  };
  const grouped = groupRelations(rels, company.id);
  const researched = rels.filter((r) => r.detail).length;
  const p = company.profile;
  const fin = company.financials;
  const latest = fin?.annual[fin.annual.length - 1];
  const perShare = !!fin?.annual.some((y) => y.epsDiluted != null || y.dividendsPerShare != null);

  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <Link to="/explore" className={styles.back}>
          <Icon icon={ArrowLeft} size="sm" /> Explore
        </Link>

        <header className={styles.header}>
          <div className={styles.identity}>
            <TickerMark ticker={company.ticker ?? company.shortName} color={color} size="lg" />
            <div className={styles.titles}>
              <Heading level="display">{company.shortName}</Heading>
              <Text variant="bodyLg" tone="secondary">{company.name}</Text>
            </div>
          </div>
          <Button variant="primary" leadingIcon={Network} onClick={() => viewInGraph(company.id)}>View in graph</Button>
        </header>

        <div className={styles.tags}>
          {company.ticker && <Badge><span className={styles.mono}>{company.ticker}</span></Badge>}
          <Badge><Swatch color={color} size="sm" />{company.sector}</Badge>
          <Badge>{company.industry}</Badge>
          <Badge>{company.hq.city}, {company.hq.country}</Badge>
          <Badge>{UNIVERSE_LABEL[company.universe]}</Badge>
        </div>

        <div className={styles.kpis}>
          <StatTile label={company.universe === 'PRIVATE' ? 'Last valuation' : 'Market cap'} value={formatCompanyCap(company)} caption={capCaption(company, dataset.asOf)} />
          <StatTile
            label={latest ? `Revenue FY${latest.fiscalYear}` : 'Revenue'}
            value={latest?.revenue != null ? formatMoney(latest.revenue, fin!.currency) : '—'}
            leading={fin && <Sparkbars values={fin.annual.map((y) => y.revenue)} label="Revenue trend" width={48} height={22} />}
            caption={fin ? `SEC filings · ${fin.currency}` : 'Not an SEC filer'}
          />
          <StatTile label="Counterparties" value={m?.degree ?? 0} caption={`${m?.outgoing ?? 0} outgoing · ${m?.incoming ?? 0} incoming`} />
          <StatTile label="Centrality rank" value={rank ? `#${rank}` : '—'} caption={`of ${dataset.companies.length} · betweenness ${formatDecimal(m?.betweenness ?? 0, 3)}`} />
        </div>

        {lenses.byId.get(company.id) && (
          <LensScorecard
            variant="full"
            company={company}
            lens={lenses.byId.get(company.id)!}
            relationships={rels}
            companyIndex={index}
            tokens={tokens}
            universe="all companies"
            onSelectRelationship={(otherId) => {
              select(company.id);
              selectEdge(pairKey(company.id, otherId), company.id);
              navigate('/explore');
            }}
            className={styles.lens}
          />
        )}

        <div className={styles.grid}>
          <section className={styles.about} aria-labelledby="about-heading">
            <Heading level="h3" as="h2" id="about-heading">About</Heading>
            {p?.description ? (
              <Text as="p" variant="body" tone="secondary" className={styles.description}>{p.description}</Text>
            ) : (
              <Text as="p" variant="body" tone="tertiary">No description available.</Text>
            )}
            <CompanyFacts
              facts={[
                { label: 'CEO', value: p?.ceo },
                { label: 'Founded', value: p?.founded },
                { label: 'Founders', value: p?.founders.join(', ') },
                { label: 'Employees', value: company.employees != null ? formatCompact(company.employees) : null },
                { label: 'Listed on', value: p?.exchanges.join(', ') },
                { label: 'Parent', value: p?.parent },
                {
                  label: 'Website',
                  value: company.website && (
                    <a href={company.website} target="_blank" rel="noreferrer noopener" className={styles.link}>{hostOf(company.website)}</a>
                  ),
                },
              ]}
            />
            {p && p.subsidiaries.length > 0 && (
              <div className={styles.list}>
                <SectionHeader title="Notable subsidiaries" />
                <Text as="p" variant="bodySm" tone="secondary">{p.subsidiaries.join(' · ')}</Text>
              </div>
            )}
            {p && p.products.length > 0 && (
              <div className={styles.list}>
                <SectionHeader title="Products" />
                <Text as="p" variant="bodySm" tone="secondary">{p.products.join(' · ')}</Text>
              </div>
            )}
            {p?.wikipediaUrl && (
              <Text as="p" variant="caption" tone="tertiary" className={styles.attribution}>
                Description from{' '}
                <a href={p.wikipediaUrl} target="_blank" rel="noreferrer noopener" className={styles.link}>
                  Wikipedia <Icon icon={ExternalLink} size="xs" className={styles.inlineIcon} />
                </a>{' '}
                (CC BY-SA 4.0); facts from Wikidata.
              </Text>
            )}
          </section>

          {fin ? (
            <ChartCard
              span={2}
              title="Financials"
              description={`Annual results from SEC XBRL filings, in ${fin.currency}.`}
              table={() => (
                <DataTable
                  columns={['Fiscal year', 'Period end', 'Revenue', 'Net income', 'R&D', ...(perShare ? ['EPS (diluted)', 'Dividend / share'] : [])]}
                  rows={fin.annual.map((y) => [
                    y.fiscalYear,
                    y.end,
                    y.revenue != null ? formatMoney(y.revenue, fin.currency) : '—',
                    y.netIncome != null ? formatMoney(y.netIncome, fin.currency) : '—',
                    y.rnd != null ? formatMoney(y.rnd, fin.currency) : '—',
                    ...(perShare
                      ? [y.epsDiluted != null ? y.epsDiluted.toFixed(2) : '—', y.dividendsPerShare != null ? y.dividendsPerShare.toFixed(2) : '—']
                      : []),
                  ])}
                />
              )}
              footnote={
                <a href={fin.sourceUrl} target="_blank" rel="noreferrer noopener" className={styles.link}>
                  Source: SEC company facts (XBRL)
                </a>
              }
            >
              <FinancialsChart financials={fin} tokens={tokens} />
            </ChartCard>
          ) : (
            <ChartCard span={2} title="Financials" description="Not available.">
              <EmptyState compact icon={SearchX} title="No SEC filings" description="Financials are drawn from SEC filings. This company doesn't file with the SEC, or is private." />
            </ChartCard>
          )}

          {flow && flow.nodes.length > 0 && (
            <ChartCard span={2} title="Supply chain" description="Suppliers on the left, customers on the right. Width is relationship strength.">
              <SupplyFlowSankey
                flow={flow}
                tokens={tokens}
                mode="company"
                height={Math.max(220, flow.nodes.length * 26)}
                onNodeClick={(n) => n.companyId && n.companyId !== company.id && navigate(`/company/${encodeURIComponent(n.companyId)}`)}
              />
            </ChartCard>
          )}
          {mix.length > 0 && (
            <ChartCard title="Relationship mix" description={`${rels.length} known relationships · ${researched} researched in depth.`}>
              <RelationshipMix data={mix} tokens={tokens} />
            </ChartCard>
          )}
        </div>

        <section className={styles.evidence} aria-labelledby="rels-heading">
          <div className={styles.evidenceHead}>
            <Heading level="h1" as="h2" id="rels-heading">Relationships</Heading>
            <Text variant="bodySm" tone="tertiary">What each tie is, what flows, how much it matters, and the sources.</Text>
          </div>
          {grouped.length === 0 && <Text tone="secondary">No relationships recorded yet.</Text>}
          {grouped.map((g) => (
            <div key={g.group} className={styles.group}>
              <SectionHeader title={`${g.label} · ${g.items.length}`} />
              <div className={styles.cards}>
                {[...g.items]
                  .sort((x, y) => Number(!!y.rel.detail) - Number(!!x.rel.detail) || y.rel.weight - x.rel.weight)
                  .map(({ rel }) => (
                    <article key={rel.id} className={styles.card}>
                      <RelationshipDetailView r={rel} companyIndex={index} tokens={tokens} />
                    </article>
                  ))}
              </div>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
