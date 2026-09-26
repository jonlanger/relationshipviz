import type { ButtonHTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';
import { X } from 'lucide-react';
import { Icon } from '../Icon';
import styles from './Tag.module.css';

export interface TagProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onToggle'> {
  /** Leading visual, typically a <Swatch />. */
  leading?: ReactNode;
  selected?: boolean;
  /** Renders a remove affordance; clicking the tag then removes it. */
  removable?: boolean;
  count?: number;
}

/** Toggleable filter chip. Renders as a button with aria-pressed. */
export function Tag({ leading, selected, removable, count, className, children, type = 'button', ...rest }: TagProps) {
  return (
    <button
      type={type}
      aria-pressed={removable ? undefined : selected}
      className={clsx(styles.tag, selected && styles.selected, className)}
      {...rest}
    >
      {leading}
      <span className={styles.label}>{children}</span>
      {count != null && <span className={styles.count}>{count}</span>}
      {removable && <Icon icon={X} size="xs" className={styles.remove} />}
    </button>
  );
}
