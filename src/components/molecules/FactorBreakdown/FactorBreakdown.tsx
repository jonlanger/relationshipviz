import clsx from 'clsx';
import styles from './FactorBreakdown.module.css';

export interface FactorBreakdownItem {
  key: string;
  label: string;
  /** Percentile 0–1, or null when the input data is missing (the factor then counts as the median). */
  score: number | null;
  /** Points added to the 0–100 score. */
  contribution: number;
  /** Configured weight; 0 hides the bar and marks the factor "off". */
  weight: number;
  explain: string;
}

export interface FactorBreakdownProps {
  factors: FactorBreakdownItem[];
  /** Bar color from the lens ramp. */
  color: string;
  /** Show the explanation under each factor. */
  detailed?: boolean;
  className?: string;
}

/** Why a lens score is what it is: one row per factor, largest contribution first. */
export function FactorBreakdown({ factors, color, detailed = true, className }: FactorBreakdownProps) {
  const sorted = [...factors].sort((a, b) => b.contribution - a.contribution);
  return (
    <ul className={clsx(styles.list, className)}>
      {sorted.map((f) => {
        const missing = f.score == null;
        const off = f.weight <= 0;
        return (
          <li key={f.key} className={clsx(styles.item, (missing || off) && styles.muted)}>
            <div className={styles.head}>
              <span className={styles.label}>{f.label}</span>
              <span className={styles.value}>{off ? 'Off' : `+${f.contribution.toFixed(1)}`}</span>
            </div>
            <span className={styles.track} aria-hidden>
              {!off && (missing ? <span className={styles.median} /> : <span className={styles.fill} style={{ width: `${Math.max(2, f.score! * 100)}%`, background: color }} />)}
            </span>
            {detailed && <p className={styles.explain}>{missing && !off ? `No data, counted as the median. ${f.explain}` : f.explain}</p>}
          </li>
        );
      })}
    </ul>
  );
}
