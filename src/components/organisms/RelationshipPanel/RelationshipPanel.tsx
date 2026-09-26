import { useState } from 'react';
import { ArrowLeft, ArrowLeftRight, ArrowRight, X } from 'lucide-react';
import type { Company, Relationship, RelationshipDetail } from '@/data/schema';
import { SYMMETRIC_TYPES } from '@/data/schema';
import type { ThemeTokens } from '@/design-system/tokens';
import { RELATIONSHIP_LABEL, RELATIONSHIP_VERB, relationshipColor, sectorColor } from '@/lib/colors';
import { formatPercent, formatUsdBillions } from '@/lib/format';
import { Badge, Button, Heading, Icon, IconButton, Swatch, Text, TickerMark } from '../../atoms';
import { EvidenceSnippet, MetricRow, SectionHeader, Timeline } from '../../molecules';
import styles from './RelationshipPanel.module.css';

export interface RelationshipPanelProps {
  /** The two companies, in the direction of the strongest relationship. */
  a: Company;
  b: Company;
  /** All relationships between the pair, strongest first. */
  relationships: Relationship[];
  companyIndex: Map<string, Company>;
  tokens: ThemeTokens;
  /** Company the user came from — renders a back link. */
  origin?: Company | null;
  onBack?: () => void;
  onSelectCompany: (id: string) => void;
  onClose: () => void;
}

const STATUS: Record<RelationshipDetail['status'], { label: string; tone: 'good' | 'accent' | 'neutral' | 'warning' }> = {
  active: { label: 'Active', tone: 'good' },
  announced: { label: 'Announced', tone: 'accent' },
  ended: { label: 'Ended', tone: 'neutral' },
  disputed: { label: 'Disputed', tone: 'warning' },
};

function provenance(r: Relationship): { label: string; tone: 'good' | 'accent' | 'neutral' | 'warning' } {
  if (r.detail?.provenance === 'verified') return { label: 'Verified research', tone: 'good' };
  if (r.detail?.provenance === 'machine') return { label: 'AI-researched · unreviewed', tone: 'warning' };
  if (r.evidence.some((e) => e.kind === 'curated')) return { label: 'Curated', tone: 'accent' };
  return { label: 'Filing mention · unverified', tone: 'warning' };
}

const MAX_SOURCES = 3;

export interface RelationshipDetailViewProps {
  r: Relationship;
  companyIndex: Map<string, Company>;
  tokens: ThemeTokens;
}

/** Everything known about one relationship: summary, numbers, flows, timeline, sources. */
export function RelationshipDetailView({ r, companyIndex, tokens }: RelationshipDetailViewProps) {
  const [allSources, setAllSources] = useState(false);
  const src = companyIndex.get(r.source)!;
  const tgt = companyIndex.get(r.target)!;
  const d = r.detail;
  const prov = provenance(r);
  const sentence = `${src.shortName} ${RELATIONSHIP_VERB[r.type][0].toLowerCase()} ${tgt.shortName}`;
  const share = d?.materiality.revenueShare;
  const shareOf = share ? companyIndex.get(share.of) : null;
  const sources = [...r.evidence].sort((x, y) => (x.kind === 'curated' ? 1 : 0) - (y.kind === 'curated' ? 1 : 0));
  const shown = allSources ? sources : sources.slice(0, MAX_SOURCES);

  return (
    <section className={styles.section} aria-label={sentence}>
      <div className={styles.sectionHead}>
        <span className={styles.type}>
          <Swatch color={relationshipColor(r.type, tokens)} shape="line" />
          <Text variant="overline" tone="secondary">{RELATIONSHIP_LABEL[r.type]}</Text>
        </span>
        <div className={styles.badges}>
          {d && <Badge tone={STATUS[d.status].tone} dot>{STATUS[d.status].label}</Badge>}
          <Badge tone={prov.tone}>{prov.label}</Badge>
        </div>
      </div>

      <Heading level="h2" as="h3">
        {sentence}
        {d?.since && <span className={styles.since}> · since {d.since}</span>}
      </Heading>

      <Text as="p" variant="body" tone="secondary" className={styles.summary}>
        {d?.summary ?? r.evidence.find((e) => e.kind === 'curated')?.note ?? r.evidence[0].note}
      </Text>

      {(d?.materiality.dealValueUsdB != null || share) && (
        <div className={styles.numbers}>
          {d?.materiality.dealValueUsdB != null && (
            <div className={styles.number}>
              <span className={styles.numberValue}>{formatUsdBillions(d.materiality.dealValueUsdB)}</span>
              <Text variant="caption" tone="tertiary">Deal / investment value</Text>
            </div>
          )}
          {share && (
            <div className={styles.number}>
              <span className={styles.numberValue}>{formatPercent(share.value)}</span>
              <Text variant="caption" tone="tertiary">
                of {shareOf?.shortName ?? share.of} revenue{share.year ? ` (${share.year})` : ''}
              </Text>
            </div>
          )}
        </div>
      )}
      {share && <Text as="p" variant="caption" tone="tertiary" className={styles.basis}>Basis: {share.basis}</Text>}

      {d && d.flows.length > 0 && (
        <div className={styles.block}>
          <SectionHeader title="What flows" />
          <ul className={styles.flows}>
            {d.flows.map((f) => (
              <li key={f} className={styles.flow}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      {d?.materiality.note && (
        <div className={styles.block}>
          <SectionHeader title="Why it matters" />
          <Text as="p" variant="bodySm" tone="secondary">{d.materiality.note}</Text>
        </div>
      )}

      <dl className={styles.meters}>
        <MetricRow label="Strength" value={formatPercent(r.weight)} fraction={r.weight} />
        <MetricRow label="Confidence" value={formatPercent(r.confidence)} fraction={r.confidence} />
      </dl>

      {d && d.events.length > 0 && (
        <div className={styles.block}>
          <SectionHeader title="Timeline" />
          <Timeline events={d.events} />
        </div>
      )}

      <div className={styles.block}>
        <SectionHeader
          title={`Sources · ${sources.length}`}
          action={
            sources.length > MAX_SOURCES && (
              <Button size="sm" variant="ghost" onClick={() => setAllSources((v) => !v)}>
                {allSources ? 'Show fewer' : 'Show all'}
              </Button>
            )
          }
        />
        <div className={styles.sources}>
          {shown.map((e, i) => (
            <EvidenceSnippet key={`${e.url}-${i}`} kind={e.kind} note={e.note} url={e.url} date={e.date} heading={e.title ?? undefined} />
          ))}
        </div>
      </div>
      {d && <Text as="p" variant="caption" tone="tertiary">Researched {d.researchedAt}</Text>}
    </section>
  );
}

/** Drawer view for a company pair: every relationship between them, explained. */
export function RelationshipPanel({ a, b, relationships, companyIndex, tokens, origin, onBack, onSelectCompany, onClose }: RelationshipPanelProps) {
  const directed = relationships.length > 0 && !SYMMETRIC_TYPES.has(relationships[0].type);
  return (
    <aside className={styles.panel} aria-label={`${a.shortName} and ${b.shortName} relationship`}>
      <header className={styles.header}>
        <div className={styles.topRow}>
          {origin && onBack ? (
            <Button size="sm" variant="ghost" leadingIcon={ArrowLeft} onClick={onBack}>{origin.shortName}</Button>
          ) : (
            <Text variant="overline" tone="tertiary">Relationship</Text>
          )}
          <IconButton icon={X} label="Close details" onClick={onClose} />
        </div>
        <div className={styles.pair}>
          <button type="button" className={styles.party} onClick={() => onSelectCompany(a.id)}>
            <TickerMark ticker={a.ticker ?? a.shortName} color={sectorColor(a.sector, tokens)} size="lg" />
            <Text variant="bodySm" weight="semibold" truncate>{a.shortName}</Text>
          </button>
          <span className={styles.link} aria-hidden>
            <Icon icon={directed ? ArrowRight : ArrowLeftRight} size="md" />
          </span>
          <button type="button" className={styles.party} onClick={() => onSelectCompany(b.id)}>
            <TickerMark ticker={b.ticker ?? b.shortName} color={sectorColor(b.sector, tokens)} size="lg" />
            <Text variant="bodySm" weight="semibold" truncate>{b.shortName}</Text>
          </button>
        </div>
      </header>
      <div className={styles.body}>
        {relationships.map((r) => (
          <RelationshipDetailView key={r.id} r={r} companyIndex={companyIndex} tokens={tokens} />
        ))}
      </div>
    </aside>
  );
}
