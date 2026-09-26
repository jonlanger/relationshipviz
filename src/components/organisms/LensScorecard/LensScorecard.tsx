import clsx from 'clsx';
import type { Company, Relationship } from '@/data/schema';
import {
  FACTOR_META,
  lensCoverage,
  lensDrivers,
  lensFactors,
  lensPct,
  lensScore,
  LOW_COVERAGE,
  STANCE_META,
  type CompanyLens,
  type LensKind,
} from '@/data/lenses';
import type { ThemeTokens } from '@/design-system/tokens';
import { LENS_LABEL, lensColor, sectorColor, STANCE_TONE } from '@/lib/colors';
import { viewRelation } from '@/lib/relations';
import { Badge, Text } from '../../atoms';
import { ConnectionRow, FactorBreakdown, ScoreMeter, SectionHeader } from '../../molecules';
import styles from './LensScorecard.module.css';

export interface LensScorecardProps {
  company: Company;
  lens: CompanyLens;
  /** Relationships touching this company (used to show drivers). */
  relationships: Relationship[];
  companyIndex: Map<string, Company>;
  tokens: ThemeTokens;
  /** compact: drawer card · full: profile section with factor breakdowns. */
  variant?: 'compact' | 'full';
  /** What scores are ranked against, e.g. "companies in view". */
  universe?: string;
  onSelectRelationship?: (otherId: string) => void;
  onHover?: (id: string | null) => void;
  className?: string;
}

const KINDS: LensKind[] = ['risk', 'opportunity'];

/** Risk & opportunity scores for one company, with the factors and relationships behind them. */
export function LensScorecard({
  company,
  lens,
  relationships,
  companyIndex,
  tokens,
  variant = 'compact',
  universe = 'companies in view',
  onSelectRelationship,
  onHover,
  className,
}: LensScorecardProps) {
  const relById = new Map(relationships.map((r) => [r.id, r]));
  const full = variant === 'full';

  const drivers = (kind: LensKind) => {
    const ds = lensDrivers(lens, kind).filter((d) => relById.has(d.relId) && companyIndex.has(d.counterpartyId)).slice(0, 3);
    if (!ds.length) return <Text as="p" variant="caption" tone="tertiary">No single relationship stands out.</Text>;
    const max = ds[0].contribution;
    return (
      <div>
        {ds.map((d) => {
          const other = companyIndex.get(d.counterpartyId)!;
          const view = viewRelation(relById.get(d.relId)!, company.id);
          return (
            <ConnectionRow
              key={d.relId}
              ticker={other.ticker ?? other.shortName}
              name={other.shortName}
              color={sectorColor(other.sector, tokens)}
              relation={d.reason}
              hint={view.verb}
              direction={view.direction}
              weight={max > 0 ? d.contribution / max : 0}
              onClick={onSelectRelationship && (() => onSelectRelationship(other.id))}
              onHover={onHover && ((h) => onHover(h ? other.id : null))}
            />
          );
        })}
      </div>
    );
  };

  return (
    <section className={clsx(styles.card, full && styles.full, className)} aria-label={`${company.shortName} risk and opportunity`}>
      <header className={styles.head}>
        <Text as="h3" variant="overline" tone="tertiary">Investor lens</Text>
        <Badge tone={STANCE_TONE[lens.stance]} dot title={STANCE_META[lens.stance].description}>
          {STANCE_META[lens.stance].label}
        </Badge>
      </header>
      <Text as="p" variant="caption" tone="secondary" className={styles.stance}>{STANCE_META[lens.stance].description}</Text>

      <div className={styles.columns}>
        {KINDS.map((kind) => (
          <div key={kind} className={styles.column}>
            <ScoreMeter
              label={LENS_LABEL[kind]}
              score={lensScore(lens, kind)}
              percentile={lensPct(lens, kind)}
              color={lensColor(kind, lensPct(lens, kind), tokens)}
              universe={universe}
              note={lensCoverage(lens, kind) < LOW_COVERAGE ? 'Limited data' : undefined}
              size={full ? 'md' : 'sm'}
            />
            {full && (
              <FactorBreakdown
                color={lensColor(kind, 0.7, tokens)}
                factors={lensFactors(lens, kind).map((f) => ({ ...f, label: FACTOR_META[f.key].label }))}
              />
            )}
            <div className={styles.drivers}>
              <SectionHeader title={kind === 'risk' ? 'Biggest exposures' : 'Biggest tailwinds'} />
              {drivers(kind)}
            </div>
          </div>
        ))}
      </div>
      <Text as="p" variant="caption" tone="tertiary" className={styles.disclaimer}>
        Rule-based signals from relationship and filing data. Not investment advice.
      </Text>
    </section>
  );
}
