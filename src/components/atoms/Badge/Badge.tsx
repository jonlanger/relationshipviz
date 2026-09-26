import type { HTMLAttributes } from 'react';
import clsx from 'clsx';
import styles from './Badge.module.css';

export type BadgeTone = 'neutral' | 'accent' | 'good' | 'warning' | 'critical';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  /** Shows a leading status dot. */
  dot?: boolean;
}

export function Badge({ tone = 'neutral', dot, className, children, ...rest }: BadgeProps) {
  return (
    <span className={clsx(styles.badge, styles[tone], className)} {...rest}>
      {dot && <span className={styles.dot} aria-hidden />}
      {children}
    </span>
  );
}
