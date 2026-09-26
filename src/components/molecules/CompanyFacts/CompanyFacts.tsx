import type { ReactNode } from 'react';
import clsx from 'clsx';
import styles from './CompanyFacts.module.css';

export interface Fact {
  label: string;
  value: ReactNode;
}

/** Compact label/value grid for profile facts (CEO, founded, exchanges…). Empty values are skipped. */
export function CompanyFacts({ facts, columns = 2, className }: { facts: Fact[]; columns?: 1 | 2 | 3; className?: string }) {
  const shown = facts.filter((f) => f.value != null && f.value !== '' && !(Array.isArray(f.value) && f.value.length === 0));
  if (!shown.length) return null;
  return (
    <dl className={clsx(styles.facts, styles[`cols${columns}`], className)}>
      {shown.map((f) => (
        <div key={f.label} className={styles.fact}>
          <dt className={styles.label}>{f.label}</dt>
          <dd className={styles.value}>{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}
