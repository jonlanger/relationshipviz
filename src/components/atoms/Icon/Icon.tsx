import type { LucideIcon, LucideProps } from 'lucide-react';
import clsx from 'clsx';
import styles from './Icon.module.css';

export type IconSize = 'xs' | 'sm' | 'md' | 'lg';
const px: Record<IconSize, number> = { xs: 12, sm: 14, md: 16, lg: 20 };

export interface IconProps extends Omit<LucideProps, 'size' | 'ref'> {
  icon: LucideIcon;
  size?: IconSize;
  /** Accessible label. Omit for decorative icons (hidden from assistive tech). */
  label?: string;
}

export function Icon({ icon: Glyph, size = 'md', label, className, ...rest }: IconProps) {
  return (
    <Glyph
      size={px[size]}
      strokeWidth={size === 'lg' ? 1.75 : 2}
      className={clsx(styles.icon, className)}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
      {...rest}
    />
  );
}
