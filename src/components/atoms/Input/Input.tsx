import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import clsx from 'clsx';
import { Icon } from '../Icon';
import styles from './Input.module.css';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  leadingIcon?: LucideIcon;
  trailing?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { leadingIcon, trailing, size = 'md', invalid, className, ...rest },
  ref,
) {
  return (
    <div className={clsx(styles.field, styles[size], invalid && styles.invalid, className)}>
      {leadingIcon && <Icon icon={leadingIcon} size="sm" className={styles.leading} />}
      <input ref={ref} className={styles.input} aria-invalid={invalid || undefined} {...rest} />
      {trailing && <span className={styles.trailing}>{trailing}</span>}
    </div>
  );
});
