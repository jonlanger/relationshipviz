import { createElement, type ComponentPropsWithoutRef } from 'react';
import clsx from 'clsx';
import styles from './Heading.module.css';

export type HeadingLevel = 'hero' | 'display' | 'h1' | 'h2' | 'h3';

const defaultTag: Record<HeadingLevel, string> = {
  hero: 'h1',
  display: 'h1',
  h1: 'h1',
  h2: 'h2',
  h3: 'h3',
};

export interface HeadingProps extends ComponentPropsWithoutRef<'h2'> {
  level?: HeadingLevel;
  /** Override the semantic tag while keeping the visual level. */
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'span';
  tone?: 'primary' | 'secondary';
}

export function Heading({ level = 'h2', as, tone = 'primary', className, ...rest }: HeadingProps) {
  return createElement(as ?? defaultTag[level], {
    className: clsx(styles.heading, styles[level], tone === 'secondary' && styles.secondary, className),
    ...rest,
  });
}
