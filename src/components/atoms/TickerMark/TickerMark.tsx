import clsx from 'clsx';
import styles from './TickerMark.module.css';

export interface TickerMarkProps {
  ticker: string;
  /** Identity color (sector). Rendered as a ring + tint, never as text color. */
  color?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/** Monogram avatar for a company — no third-party logos, so it scales to any universe. */
export function TickerMark({ ticker, color, size = 'md', className }: TickerMarkProps) {
  const short = ticker.replace(/[^A-Z0-9]/gi, '').slice(0, size === 'sm' ? 2 : 4).toUpperCase();
  return (
    <span
      aria-hidden
      className={clsx(styles.mark, styles[size], className)}
      style={color ? { ['--mark' as string]: color } : undefined}
    >
      {short}
    </span>
  );
}
