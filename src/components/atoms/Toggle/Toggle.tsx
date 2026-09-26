import { useId, type ReactNode } from 'react';
import clsx from 'clsx';
import styles from './Toggle.module.css';

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  disabled?: boolean;
  className?: string;
}

export function Toggle({ checked, onChange, label, disabled, className }: ToggleProps) {
  const id = useId();
  return (
    <label className={clsx(styles.root, disabled && styles.disabled, className)}>
      <span id={id} className={styles.label}>{label}</span>
      <button
        type="button"
        role="switch"
        aria-labelledby={id}
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={clsx(styles.track, checked && styles.on)}
      >
        <span className={styles.thumb} />
      </button>
    </label>
  );
}
