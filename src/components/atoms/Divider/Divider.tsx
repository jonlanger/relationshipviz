import clsx from 'clsx';
import styles from './Divider.module.css';

export function Divider({ orientation = 'horizontal', className }: { orientation?: 'horizontal' | 'vertical'; className?: string }) {
  return <hr aria-orientation={orientation} className={clsx(styles.divider, styles[orientation], className)} />;
}
