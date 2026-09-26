import type { ReactNode } from 'react';
import clsx from 'clsx';
import { Text } from '../../atoms';
import styles from './StatTile.module.css';

export interface StatTileProps {
  label: string;
  value: ReactNode;
  /** Secondary line: context, comparison or the entity behind the number. */
  caption?: ReactNode;
  /** Optional leading visual for entity-valued stats (e.g. a TickerMark). */
  leading?: ReactNode;
  emphasis?: 'default' | 'hero';
  onClick?: () => void;
  className?: string;
}

/** A headline number. When the answer is a single value, this beats a chart. */
export function StatTile({ label, value, caption, leading, emphasis = 'default', onClick, className }: StatTileProps) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={clsx(styles.tile, styles[emphasis], onClick && styles.interactive, className)}
    >
      <Text variant="caption" tone="secondary" weight="medium">{label}</Text>
      <div className={styles.valueRow}>
        {leading}
        <span className={styles.value}>{value}</span>
      </div>
      {caption && <Text variant="caption" tone="tertiary" className={styles.caption}>{caption}</Text>}
    </Tag>
  );
}
