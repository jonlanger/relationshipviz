import clsx from 'clsx';
import { Swatch, Text } from '../../atoms';
import styles from './Legend.module.css';

export interface LegendEntry {
  key: string;
  label: string;
  color: string;
  /** Optional count shown after the label. */
  value?: number | string;
  muted?: boolean;
}

export interface LegendProps {
  title?: string;
  entries: LegendEntry[];
  shape?: 'dot' | 'square' | 'line';
  orientation?: 'vertical' | 'horizontal';
  onEntryClick?: (key: string) => void;
  className?: string;
}

export function Legend({ title, entries, shape = 'dot', orientation = 'vertical', onEntryClick, className }: LegendProps) {
  return (
    <div className={clsx(styles.legend, className)}>
      {title && <Text variant="overline" tone="tertiary">{title}</Text>}
      <ul className={clsx(styles.list, styles[orientation])}>
        {entries.map((e) => {
          const content = (
            <>
              <Swatch color={e.color} shape={shape} size="sm" />
              <span className={styles.label}>{e.label}</span>
              {e.value != null && <span className={styles.value}>{e.value}</span>}
            </>
          );
          return (
            <li key={e.key} className={clsx(styles.item, e.muted && styles.muted)}>
              {onEntryClick ? (
                <button type="button" className={styles.button} onClick={() => onEntryClick(e.key)}>{content}</button>
              ) : (
                content
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
