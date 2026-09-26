import type { EdgeAttrs } from '@/data/graph';
import type { LensResult } from '@/data/lenses';
import type { Lens } from '@/app/store';
import { RELATIONSHIP_LABEL, RELATIONSHIP_VERB } from '@/lib/colors';
import { formatUsdBillions } from '@/lib/format';
import { Text } from '../../atoms';
import styles from './NetworkGraph.module.css';

export interface EdgeTooltipProps {
  attrs: EdgeAttrs;
  visibleIds: Set<string>;
  names: (id: string) => string;
  x: number;
  y: number;
  lens?: Lens;
  lenses?: LensResult | null;
}

const firstSentence = (s: string) => s.match(/^.+?[.!?](\s|$)/)?.[0].trim() ?? s;

/** Hover card for a graph edge: who does what to whom, and the headline fact. */
export function EdgeTooltip({ attrs, visibleIds, names, x, y, lens = 'off', lenses }: EdgeTooltipProps) {
  const rels = attrs.relationships.filter((r) => visibleIds.has(r.id));
  if (!rels.length) return null;
  const top = rels[0];
  const detail = rels.find((r) => r.detail)?.detail;
  // In a lens, say whose score this link moves and why.
  const lensNote = (() => {
    if (lens === 'off' || !lenses) return null;
    const best = rels
      .map((r) => lenses.byRel.get(r.id))
      .filter((x) => x != null)
      .sort((a, b) => b[lens] - a[lens])[0];
    const who = lens === 'risk' ? best?.riskFor : best?.opportunityFor;
    const why = lens === 'risk' ? best?.riskReason : best?.opportunityReason;
    return best && who && why && best[lens] > 0 ? `${why} · raises ${names(who)}’s ${lens}` : null;
  })();
  return (
    <div className={styles.edgeTip} style={{ left: x, top: y }} role="tooltip">
      {rels.map((r) => (
        <Text key={r.id} as="p" variant="bodySm" weight="semibold">
          {names(r.source)} {RELATIONSHIP_VERB[r.type][0].toLowerCase()} {names(r.target)}
        </Text>
      ))}
      <Text as="p" variant="caption" tone="secondary" className={styles.edgeTipBody}>
        {detail ? firstSentence(detail.summary) : top.evidence[0].note}
      </Text>
      {lensNote && (
        <Text as="p" variant="caption" weight="medium">{lensNote}</Text>
      )}
      <div className={styles.edgeTipMeta}>
        <Text variant="caption" tone="tertiary">{rels.map((r) => RELATIONSHIP_LABEL[r.type]).join(' · ')}</Text>
        {detail?.materiality.dealValueUsdB != null && (
          <Text variant="caption" weight="medium">{formatUsdBillions(detail.materiality.dealValueUsdB)}</Text>
        )}
        <Text variant="caption" tone="accent" className={styles.edgeTipCta}>Click for details</Text>
      </div>
    </div>
  );
}
