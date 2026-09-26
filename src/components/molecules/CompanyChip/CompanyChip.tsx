import type { ReactNode } from 'react';
import clsx from 'clsx';
import { Text, TickerMark } from '../../atoms';
import styles from './CompanyChip.module.css';

export interface CompanyChipProps {
  ticker: string;
  name: string;
  meta?: ReactNode;
  color?: string;
  size?: 'sm' | 'md';
  trailing?: ReactNode;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  active?: boolean;
  className?: string;
}

/** Identity row for a company: monogram, name, secondary meta. */
export function CompanyChip({ ticker, name, meta, color, size = 'md', trailing, onClick, onMouseEnter, onMouseLeave, active, className }: CompanyChipProps) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={clsx(styles.chip, styles[size], onClick && styles.interactive, active && styles.active, className)}
    >
      <TickerMark ticker={ticker} color={color} size="sm" />
      <span className={styles.text}>
        <Text variant={size === 'sm' ? 'bodySm' : 'body'} weight="medium" truncate>{name}</Text>
        {meta && <Text variant="caption" tone="tertiary" truncate>{meta}</Text>}
      </span>
      {trailing && <span className={styles.trailing}>{trailing}</span>}
    </Tag>
  );
}
