import { forwardRef, useEffect, useImperativeHandle, useRef, type InputHTMLAttributes, type ReactNode } from 'react';
import clsx from 'clsx';
import { Check, Minus } from 'lucide-react';
import styles from './Checkbox.module.css';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: ReactNode;
  indeterminate?: boolean;
  trailing?: ReactNode;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, indeterminate, trailing, className, ...rest },
  ref,
) {
  const inner = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => inner.current as HTMLInputElement);
  useEffect(() => {
    if (inner.current) inner.current.indeterminate = !!indeterminate;
  }, [indeterminate]);

  return (
    <label className={clsx(styles.root, rest.disabled && styles.disabled, className)}>
      <input ref={inner} type="checkbox" className={styles.input} {...rest} />
      <span className={styles.box} aria-hidden>
        {indeterminate ? <Minus size={11} strokeWidth={3} /> : <Check size={11} strokeWidth={3} />}
      </span>
      {label && <span className={styles.label}>{label}</span>}
      {trailing && <span className={styles.trailing}>{trailing}</span>}
    </label>
  );
});
