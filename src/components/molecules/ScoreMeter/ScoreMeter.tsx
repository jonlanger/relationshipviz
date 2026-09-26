import clsx from 'clsx';
import styles from './ScoreMeter.module.css';

export interface ScoreMeterProps {
  label: string;
  /** 0–100. */
  score: number;
  /** Percentile among the comparison set, 0–1. */
  percentile: number;
  /** Mark color (from the lens ramp). Text never takes it. */
  color: string;
  /** What the percentile is relative to, e.g. "companies in view". */
  universe?: string;
  /** Extra note under the caption, e.g. "Limited data". */
  note?: string;
  size?: 'sm' | 'md';
  className?: string;
}

/** A 0–100 lens score with its rank, as a hero number over a thin bar. */
export function ScoreMeter({ label, score, percentile, color, universe = 'companies in view', note, size = 'md', className }: ScoreMeterProps) {
  const rounded = Math.round(score);
  return (
    <div className={clsx(styles.meter, styles[size], className)}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>
        {rounded}
        <span className={styles.of}>/100</span>
      </span>
      <span
        className={styles.track}
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={rounded}
      >
        <span className={styles.fill} style={{ width: `${Math.max(2, Math.min(100, score))}%`, background: color }} />
      </span>
      <span className={styles.caption}>
        {percentile >= 1 ? `Highest of ${universe}` : `Higher than ${Math.round(percentile * 100)}% of ${universe}`}
        {note && <span className={styles.note}> · {note}</span>}
      </span>
    </div>
  );
}
