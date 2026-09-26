import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import clsx from 'clsx';
import { Heading, Icon, Text } from '../../atoms';
import styles from './EmptyState.module.css';

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
}

export function EmptyState({ icon, title, description, action, compact, className }: EmptyStateProps) {
  return (
    <div className={clsx(styles.empty, compact && styles.compact, className)}>
      <span className={styles.icon}><Icon icon={icon} size="lg" /></span>
      <Heading level="h3" as="p">{title}</Heading>
      {description && <Text as="p" variant="bodySm" tone="secondary" className={styles.description}>{description}</Text>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
