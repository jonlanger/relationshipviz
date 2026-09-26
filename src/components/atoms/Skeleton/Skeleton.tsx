import type { CSSProperties } from 'react';
import clsx from 'clsx';
import styles from './Skeleton.module.css';

export function Skeleton({ width, height = 12, radius, className }: { width?: CSSProperties['width']; height?: CSSProperties['height']; radius?: string; className?: string }) {
  return <span aria-hidden className={clsx(styles.skeleton, className)} style={{ width, height, borderRadius: radius }} />;
}
