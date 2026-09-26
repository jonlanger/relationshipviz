import { useId, type ReactNode } from 'react';
import clsx from 'clsx';
import styles from './Slider.module.css';

export interface SliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label: ReactNode;
  /** Formats the value readout. */
  format?: (v: number) => string;
  className?: string;
}

export function Slider({ value, onChange, min = 0, max = 100, step = 1, label, format = String, className }: SliderProps) {
  const id = useId();
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className={clsx(styles.root, className)}>
      <div className={styles.header}>
        <label htmlFor={id} className={styles.label}>{label}</label>
        <output htmlFor={id} className={styles.value}>{format(value)}</output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={styles.input}
        style={{ ['--pct' as string]: `${pct}%` }}
      />
    </div>
  );
}
