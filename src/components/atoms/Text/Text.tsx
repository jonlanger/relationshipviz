import { createElement, type ComponentPropsWithoutRef, type ElementType, type ReactNode } from 'react';
import clsx from 'clsx';
import styles from './Text.module.css';

export type TextVariant = 'bodyLg' | 'body' | 'bodySm' | 'caption' | 'overline';
export type TextTone = 'primary' | 'secondary' | 'tertiary' | 'accent' | 'good' | 'critical' | 'inherit';

export interface TextProps extends Omit<ComponentPropsWithoutRef<'span'>, 'color'> {
  as?: ElementType;
  variant?: TextVariant;
  tone?: TextTone;
  weight?: 'regular' | 'medium' | 'semibold';
  /** Monospace with tabular figures — tickers, numbers in columns. */
  mono?: boolean;
  /** Tabular figures without switching face — aligned numbers in sans. */
  numeric?: boolean;
  truncate?: boolean;
  children?: ReactNode;
}

export function Text({
  as = 'span',
  variant = 'body',
  tone = 'primary',
  weight,
  mono,
  numeric,
  truncate,
  className,
  ...rest
}: TextProps) {
  return createElement(as, {
    className: clsx(
      styles.text,
      styles[variant],
      styles[`tone-${tone}`],
      weight && styles[weight],
      mono && styles.mono,
      numeric && styles.numeric,
      truncate && styles.truncate,
      className,
    ),
    ...rest,
  });
}
