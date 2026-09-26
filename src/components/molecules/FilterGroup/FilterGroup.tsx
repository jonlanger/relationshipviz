import type { ReactNode } from 'react';
import { Button, Checkbox } from '../../atoms';
import { SectionHeader } from '../SectionHeader';
import styles from './FilterGroup.module.css';

export interface FilterOption<T extends string> {
  value: T;
  label: string;
  leading?: ReactNode;
  count?: number;
}

export interface FilterGroupProps<T extends string> {
  title: string;
  options: FilterOption<T>[];
  selected: T[];
  onToggle: (value: T) => void;
  onSetAll: (values: T[]) => void;
}

/** Titled multi-select checklist with all/none shortcuts. */
export function FilterGroup<T extends string>({ title, options, selected, onToggle, onSetAll }: FilterGroupProps<T>) {
  const all = selected.length === options.length;
  return (
    <fieldset className={styles.group}>
      <legend className="sr-only">{title}</legend>
      <SectionHeader
        title={title}
        action={
          <Button size="sm" variant="ghost" onClick={() => onSetAll(all ? [] : options.map((o) => o.value))}>
            {all ? 'None' : 'All'}
          </Button>
        }
      />
      <div className={styles.list}>
        {options.map((o) => (
          <Checkbox
            key={o.value}
            checked={selected.includes(o.value)}
            onChange={() => onToggle(o.value)}
            label={
              <>
                {o.leading}
                <span className={styles.label}>{o.label}</span>
              </>
            }
            trailing={o.count}
          />
        ))}
      </div>
    </fieldset>
  );
}
