import type { ReactNode } from 'react';
import styles from './MetricRow.module.css';

export interface MetricRowProps {
  label: ReactNode;
  value: ReactNode;
  /** 0–1: renders a thin proportional bar under the row. */
  fraction?: number;
}

/** Label/value pair for dense definition lists. Renders dt/dd — wrap rows in a <dl>. */
export function MetricRow({ label, value, fraction }: MetricRowProps) {
  return (
    <div className={styles.row}>
      <dt className={styles.label}>{label}</dt>
      <dd className={styles.value}>{value}</dd>
      {fraction != null && (
        <div className={styles.track} aria-hidden>
          <div className={styles.fill} style={{ width: `${Math.max(2, Math.min(1, fraction) * 100)}%` }} />
        </div>
      )}
    </div>
  );
}
