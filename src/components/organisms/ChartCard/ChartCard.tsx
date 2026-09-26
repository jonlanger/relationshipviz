import { useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { BarChart3, Table2 } from 'lucide-react';
import { Heading, IconButton, Text } from '../../atoms';
import styles from './ChartCard.module.css';

export interface ChartCardProps {
  title: string;
  /** One line on what the chart answers. */
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  /** Table view of the same data — every chart ships one. */
  table?: () => ReactNode;
  footnote?: ReactNode;
  span?: 1 | 2 | 3;
  className?: string;
}

export function ChartCard({ title, description, actions, children, table, footnote, span = 1, className }: ChartCardProps) {
  const [asTable, setAsTable] = useState(false);
  return (
    <section className={clsx(styles.card, styles[`span${span}`], className)} aria-label={title}>
      <header className={styles.header}>
        <div className={styles.titles}>
          <Heading level="h3" as="h2">{title}</Heading>
          {description && <Text as="p" variant="bodySm" tone="tertiary">{description}</Text>}
        </div>
        <div className={styles.actions}>
          {actions}
          {table && (
            <IconButton
              icon={asTable ? BarChart3 : Table2}
              label={asTable ? 'Show chart' : 'Show table'}
              size="sm"
              onClick={() => setAsTable((v) => !v)}
            />
          )}
        </div>
      </header>
      <div className={styles.body}>{asTable && table ? <div className={styles.table}>{table()}</div> : children}</div>
      {footnote && <footer className={styles.footnote}><Text variant="caption" tone="tertiary">{footnote}</Text></footer>}
    </section>
  );
}

/** Minimal accessible data table for ChartCard table views. */
export function DataTable({ columns, rows }: { columns: string[]; rows: (string | number)[][] }) {
  return (
    <table className={styles.dataTable}>
      <thead>
        <tr>{columns.map((c) => <th key={c} scope="col">{c}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>{r.map((v, j) => <td key={j}>{v}</td>)}</tr>
        ))}
      </tbody>
    </table>
  );
}
