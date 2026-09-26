import clsx from 'clsx';
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight } from 'lucide-react';
import { Icon, Text, TickerMark } from '../../atoms';
import styles from './ConnectionRow.module.css';

export interface ConnectionRowProps {
  ticker: string;
  name: string;
  color?: string;
  /** e.g. "Supplies", "Supplied by", "Competes with". */
  relation: string;
  direction: 'out' | 'in' | 'both';
  /** 0–1 tie strength. */
  weight: number;
  lowConfidence?: boolean;
  /** Short detail line, e.g. the main thing that flows ("CoWoS packaging"). */
  hint?: string;
  /** Marks relationships that have researched detail behind them. */
  researched?: boolean;
  onClick?: () => void;
  onHover?: (hovering: boolean) => void;
}

const DIR_ICON = { out: ArrowUpRight, in: ArrowDownLeft, both: ArrowLeftRight };

/** One counterparty in a company's connection list. */
export function ConnectionRow({ ticker, name, color, relation, direction, weight, lowConfidence, hint, researched, onClick, onHover }: ConnectionRowProps) {
  return (
    <button
      type="button"
      className={clsx(styles.row)}
      onClick={onClick}
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
      onFocus={() => onHover?.(true)}
      onBlur={() => onHover?.(false)}
    >
      <TickerMark ticker={ticker} color={color} size="sm" />
      <span className={styles.body}>
        <span className={styles.nameRow}>
          <Text variant="bodySm" weight="medium" truncate>{name}</Text>
          {researched && <span className={styles.researched} title="Researched detail available" aria-label="Researched" />}
        </span>
        <span className={styles.relation}>
          <Icon icon={DIR_ICON[direction]} size="xs" />
          <Text variant="caption" tone="tertiary" truncate>
            {relation}
            {hint && ` · ${hint}`}
            {lowConfidence && ' · unverified'}
          </Text>
        </span>
      </span>
      <span className={styles.strength} aria-label={`Strength ${Math.round(weight * 100)} of 100`}>
        <span className={styles.bar}><span className={styles.fill} style={{ width: `${weight * 100}%` }} /></span>
      </span>
    </button>
  );
}
