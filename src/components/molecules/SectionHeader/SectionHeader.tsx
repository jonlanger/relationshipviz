import type { ReactNode } from 'react';
import clsx from 'clsx';
import { Text } from '../../atoms';
import styles from './SectionHeader.module.css';

export interface SectionHeaderProps {
  title: ReactNode;
  /** Right-aligned actions or meta (counts, "Reset"). */
  action?: ReactNode;
  className?: string;
}

/** Overline-style label that opens a panel section. */
export function SectionHeader({ title, action, className }: SectionHeaderProps) {
  return (
    <div className={clsx(styles.header, className)}>
      <Text as="h3" variant="overline" tone="tertiary">{title}</Text>
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
