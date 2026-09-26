import clsx from 'clsx';
import styles from './Swatch.module.css';

export interface SwatchProps {
  color: string;
  shape?: 'dot' | 'square' | 'line';
  size?: 'sm' | 'md';
  className?: string;
}

/** A data-identity mark. Always pair with a text label — color never carries meaning alone. */
export function Swatch({ color, shape = 'dot', size = 'md', className }: SwatchProps) {
  return (
    <span
      aria-hidden
      className={clsx(styles.swatch, styles[shape], styles[size], className)}
      style={{ ['--swatch' as string]: color }}
    />
  );
}
