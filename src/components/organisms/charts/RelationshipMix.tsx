import type { RelationshipType } from '@/data/schema';
import type { ThemeTokens } from '@/design-system/tokens';
import { RELATIONSHIP_LABEL, relationshipColor } from '@/lib/colors';
import { formatPercent } from '@/lib/format';
import styles from './RelationshipMix.module.css';

export interface RelationshipMixProps {
  data: { type: RelationshipType; count: number }[];
  tokens: ThemeTokens;
  onPick?: (t: RelationshipType) => void;
}

/** Part-to-whole in a single 100% bar with direct labels below — no pie. */
export function RelationshipMix({ data, tokens, onPick }: RelationshipMixProps) {
  const total = data.reduce((a, d) => a + d.count, 0) || 1;
  return (
    <div className={styles.mix}>
      <div className={styles.bar} role="img" aria-label="Share of relationships by type">
        {data.map((d) => (
          <span key={d.type} className={styles.segment} style={{ flexGrow: d.count, background: relationshipColor(d.type, tokens) }} title={`${RELATIONSHIP_LABEL[d.type]}: ${d.count}`} />
        ))}
      </div>
      <ul className={styles.labels}>
        {data.map((d) => (
          <li key={d.type}>
            <button type="button" className={styles.item} onClick={() => onPick?.(d.type)} disabled={!onPick}>
              <span className={styles.swatch} style={{ background: relationshipColor(d.type, tokens) }} />
              <span className={styles.name}>{RELATIONSHIP_LABEL[d.type]}</span>
              <span className={styles.value}>{d.count}</span>
              <span className={styles.pct}>{formatPercent(d.count / total)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
