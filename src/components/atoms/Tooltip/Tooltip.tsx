import { cloneElement, isValidElement, useId, useState, type ReactElement, type ReactNode } from 'react';
import clsx from 'clsx';
import styles from './Tooltip.module.css';

export interface TooltipProps {
  content: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  children: ReactElement;
  className?: string;
}

/** Lightweight tooltip for supplementary text. Shows on hover and keyboard focus. */
export function Tooltip({ content, side = 'top', children, className }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const trigger = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, { 'aria-describedby': open ? id : undefined })
    : children;
  return (
    <span
      className={clsx(styles.wrap, className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {trigger}
      <span id={id} role="tooltip" className={clsx(styles.tip, styles[side], open && styles.open)}>
        {content}
      </span>
    </span>
  );
}
