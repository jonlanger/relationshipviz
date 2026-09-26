import { useMemo } from 'react';
import { ArrowRight, Link2Off, X } from 'lucide-react';
import type { Company, Relationship } from '@/data/schema';
import type { NodeMetrics } from '@/data/metrics';
import type { CompanyLens } from '@/data/lenses';
import type { ThemeTokens } from '@/design-system/tokens';
import { sectorColor } from '@/lib/colors';
import { groupRelations } from '@/lib/relations';
import { formatCompact, formatCompanyCap, formatDecimal, formatMoney } from '@/lib/format';
import {
  Badge,
  Button,
  Heading,
  IconButton,
  Sparkbars,
  Swatch,
  Text,
  TickerMark,
} from '../../atoms';
import { CompanyFacts, ConnectionRow, EmptyState, MetricRow, SectionHeader } from '../../molecules';
import { LensScorecard } from '../LensScorecard';
import styles from './CompanyDetailPanel.module.css';

export interface CompanyDetailPanelProps {
  company: Company;
  /** Visible relationships touching this company. */
  relationships: Relationship[];
  companyIndex: Map<string, Company>;
  metrics: NodeMetrics | undefined;
  /** 1-based rank by betweenness among visible companies. */
  centralityRank: number | null;
  totalCompanies: number;
  /** Risk & opportunity scores, ranked among visible companies. */
  lens?: CompanyLens;
  tokens: ThemeTokens;
  /** Open the relationship between this company and `otherId`. */
  onSelectRelationship: (otherId: string) => void;
  onHover: (id: string | null) => void;
  onClose: () => void;
  onOpenProfile: (id: string) => void;
}

const UNIVERSE_LABEL = { SP500: 'S&P 500', GLOBAL: 'Global', PRIVATE: 'Private' } as const;

export function CompanyDetailPanel({
  company,
  relationships,
  companyIndex,
  metrics,
  centralityRank,
  totalCompanies,
  lens,
  tokens,
  onSelectRelationship,
  onHover,
  onClose,
  onOpenProfile,
}: CompanyDetailPanelProps) {
  const groups = useMemo(
    () =>
      groupRelations(
        relationships.filter((r) =>
          companyIndex.has(r.source === company.id ? r.target : r.source),
        ),
        company.id,
      ),
    [relationships, company.id, companyIndex],
  );

  const color = sectorColor(company.sector, tokens);
  const annual = company.financials?.annual ?? [];
  const latest = annual.length ? annual[annual.length - 1] : undefined;

  return (
    <aside className={styles.panel} aria-label={`${company.shortName} details`}>
      <header className={styles.header}>
        <div className={styles.identity}>
          <TickerMark ticker={company.ticker ?? company.shortName} color={color} size="lg" />
          <div className={styles.names}>
            <Heading level="h1" as="h2">
              {company.shortName}
            </Heading>
            <Text variant="bodySm" tone="tertiary" truncate>
              {company.name}
            </Text>
          </div>
        </div>
        <IconButton icon={X} label="Close details" onClick={onClose} />
      </header>

      {/* Everything between the header and the footer scrolls together, so the footer button always stays visible. */}
      <div className={styles.body}>
        <div className={styles.tags}>
          {company.ticker && (
            <Badge>
              <span className={styles.mono}>{company.ticker}</span>
            </Badge>
          )}
          <Badge>
            <Swatch color={color} size="sm" />
            {company.sector}
          </Badge>
          <Badge>{UNIVERSE_LABEL[company.universe]}</Badge>
        </div>
        <Text as="p" variant="bodySm" tone="secondary" className={styles.sub}>
          {company.industry} · {company.hq.city}, {company.hq.countryCode}
        </Text>

        {company.profile?.description && (
          <Text as="p" variant="bodySm" tone="secondary" className={styles.description}>
            {company.profile.description}
          </Text>
        )}
        {company.profile && (
          <CompanyFacts
            className={styles.facts}
            facts={[
              { label: 'CEO', value: company.profile.ceo },
              { label: 'Founded', value: company.profile.founded },
            ]}
          />
        )}

        <dl className={styles.metrics}>
          <MetricRow
            label={company.universe === 'PRIVATE' ? 'Last valuation' : 'Market cap'}
            value={formatCompanyCap(company)}
          />
          {latest && company.financials && (
            <MetricRow
              label={`Revenue FY${String(latest.fiscalYear).slice(2)}`}
              value={
                <span className={styles.revenue}>
                  <Sparkbars
                    values={company.financials.annual.map((y) => y.revenue)}
                    label={`Revenue trend, ${company.financials.annual.length} fiscal years`}
                    width={56}
                    height={16}
                  />
                  {latest.revenue != null
                    ? formatMoney(latest.revenue, company.financials.currency)
                    : '—'}
                </span>
              }
            />
          )}
          {company.employees != null && (
            <MetricRow label="Employees" value={formatCompact(company.employees)} />
          )}
          <MetricRow label="Counterparties" value={metrics?.degree ?? 0} />
          <MetricRow
            label="Betweenness"
            value={
              <>
                {formatDecimal(metrics?.betweenness ?? 0, 3)}
                {centralityRank && (
                  <span className={styles.rank}>
                    {' '}
                    · #{centralityRank} of {totalCompanies}
                  </span>
                )}
              </>
            }
            fraction={metrics?.betweenness ?? 0}
          />
        </dl>

        {lens && (
          <LensScorecard
            company={company}
            lens={lens}
            relationships={relationships}
            companyIndex={companyIndex}
            tokens={tokens}
            onSelectRelationship={onSelectRelationship}
            onHover={onHover}
            className={styles.lens}
          />
        )}

        <div className={styles.connections}>
          {groups.length === 0 ? (
            <EmptyState
              compact
              icon={Link2Off}
              title="No visible connections"
              description="Relationships for this company are hidden by the current filters."
            />
          ) : (
            groups.map((g) => (
              <section key={g.group} className={styles.group}>
                <SectionHeader title={`${g.label} · ${g.items.length}`} />
                <div>
                  {g.items.map(({ rel, view }) => {
                    const other = companyIndex.get(view.otherId)!;
                    return (
                      <ConnectionRow
                        key={rel.id}
                        ticker={other.ticker ?? other.shortName}
                        name={other.shortName}
                        color={sectorColor(other.sector, tokens)}
                        relation={view.verb}
                        hint={rel.detail?.flows[0]}
                        researched={!!rel.detail}
                        direction={view.direction}
                        weight={rel.weight}
                        lowConfidence={rel.confidence < 0.5}
                        onClick={() => onSelectRelationship(other.id)}
                        onHover={(h) => onHover(h ? other.id : null)}
                      />
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </div>
      </div>

      <footer className={styles.footer}>
        <Button fullWidth trailingIcon={ArrowRight} onClick={() => onOpenProfile(company.id)}>
          Full profile & evidence
        </Button>
      </footer>
    </aside>
  );
}
