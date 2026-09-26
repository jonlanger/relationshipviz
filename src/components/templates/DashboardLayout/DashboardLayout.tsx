import type { ReactNode } from 'react';
import { Heading, Text } from '../../atoms';
import styles from './DashboardLayout.module.css';

export interface DashboardLayoutProps {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  /** Row above the grid (KPIs, active filters). */
  summary?: ReactNode;
  children: ReactNode;
}

/** Scrolling page with a title block and a 3-column responsive card grid. */
export function DashboardLayout({ eyebrow, title, description, actions, summary, children }: DashboardLayoutProps) {
  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <div className={styles.titles}>
            {eyebrow && <Text variant="overline" tone="accent">{eyebrow}</Text>}
            <Heading level="display">{title}</Heading>
            {description && <Text as="p" variant="bodyLg" tone="secondary" className={styles.description}>{description}</Text>}
          </div>
          {actions && <div className={styles.actions}>{actions}</div>}
        </header>
        {summary && <div className={styles.summary}>{summary}</div>}
        <div className={styles.grid}>{children}</div>
      </div>
    </main>
  );
}
