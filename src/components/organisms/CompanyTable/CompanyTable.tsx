import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { ArrowDown, ArrowUp, Search } from 'lucide-react';
import type { Company } from '@/data/schema';
import type { NetworkMetrics } from '@/data/metrics';
import { STANCE_META, type LensResult, type Stance } from '@/data/lenses';
import type { ThemeTokens } from '@/design-system/tokens';
import { sectorColor, STANCE_TONE } from '@/lib/colors';
import { formatCompanyCap, formatDecimal } from '@/lib/format';
import { Badge, Icon, Input, Swatch, Text, TickerMark } from '../../atoms';
import styles from './CompanyTable.module.css';

type SortKey = 'name' | 'sector' | 'country' | 'marketCap' | 'degree' | 'betweenness' | 'risk' | 'opportunity' | 'stance';

export interface CompanyTableProps {
  companies: Company[];
  metrics: NetworkMetrics;
  tokens: ThemeTokens;
  onRowClick?: (id: string) => void;
  maxHeight?: number;
  /** Adds sortable Risk, Opportunity and Stance columns. */
  lenses?: LensResult | null;
  /** Initial sort column. */
  defaultSort?: SortKey;
}

const STANCE_ORDER: Record<Stance, number> = { add: 3, watch: 2, hold: 1, reduce: 0 };
const LENS_COLUMNS: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: 'risk', label: 'Risk', numeric: true },
  { key: 'opportunity', label: 'Opportunity', numeric: true },
  { key: 'stance', label: 'Stance', numeric: true },
];

const COLUMNS: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: 'name', label: 'Company' },
  { key: 'sector', label: 'Sector' },
  { key: 'country', label: 'HQ' },
  { key: 'marketCap', label: 'Market cap', numeric: true },
  { key: 'degree', label: 'Links', numeric: true },
  { key: 'betweenness', label: 'Betweenness', numeric: true },
];

export function CompanyTable({ companies, metrics, tokens, onRowClick, maxHeight = 520, lenses, defaultSort = 'marketCap' }: CompanyTableProps) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: defaultSort, dir: -1 });
  const columns = lenses ? [...COLUMNS, ...LENS_COLUMNS] : COLUMNS;
  const [q, setQ] = useState('');

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const val = (c: Company): string | number => {
      const m = metrics.byId.get(c.id);
      switch (sort.key) {
        case 'name': return c.shortName.toLowerCase();
        case 'sector': return c.sector;
        case 'country': return c.hq.countryCode;
        case 'marketCap': return c.marketCap;
        case 'degree': return m?.degree ?? 0;
        case 'betweenness': return m?.betweenness ?? 0;
        case 'risk': return lenses?.byId.get(c.id)?.risk ?? 0;
        case 'opportunity': return lenses?.byId.get(c.id)?.opportunity ?? 0;
        case 'stance': {
          const l = lenses?.byId.get(c.id);
          return l ? STANCE_ORDER[l.stance] * 1000 + l.opportunity - l.risk : 0;
        }
      }
    };
    return companies
      .filter((c) => !needle || c.shortName.toLowerCase().includes(needle) || (c.ticker ?? '').toLowerCase().includes(needle) || c.industry.toLowerCase().includes(needle))
      .sort((a, b) => {
        const va = val(a);
        const vb = val(b);
        return (va < vb ? -1 : va > vb ? 1 : 0) * sort.dir;
      });
  }, [companies, metrics, lenses, sort, q]);

  const toggleSort = (key: SortKey, numeric?: boolean) =>
    setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: numeric ? -1 : 1 }));

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <Input size="sm" leadingIcon={Search} placeholder="Filter by name, ticker or industry" value={q} onChange={(e) => setQ(e.target.value)} className={styles.filter} />
        <Text variant="caption" tone="tertiary">{rows.length} of {companies.length}</Text>
      </div>
      <div className={styles.scroller} style={{ maxHeight }}>
        <table className={styles.table}>
          <thead>
            <tr>
              {columns.map((c) => {
                const active = sort.key === c.key;
                return (
                  <th key={c.key} scope="col" aria-sort={active ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'} className={clsx(c.numeric && styles.num)}>
                    <button type="button" className={clsx(styles.sortBtn, active && styles.sortActive)} onClick={() => toggleSort(c.key, c.numeric)}>
                      {c.label}
                      {active && <Icon icon={sort.dir === 1 ? ArrowUp : ArrowDown} size="xs" />}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const m = metrics.byId.get(c.id);
              const l = lenses?.byId.get(c.id);
              return (
                <tr
                  key={c.id}
                  className={clsx(onRowClick && styles.clickable)}
                  onClick={() => onRowClick?.(c.id)}
                  onKeyDown={(e) => e.key === 'Enter' && onRowClick?.(c.id)}
                  tabIndex={onRowClick ? 0 : undefined}
                >
                  <td>
                    <span className={styles.company}>
                      <TickerMark ticker={c.ticker ?? c.shortName} color={sectorColor(c.sector, tokens)} size="sm" />
                      <span className={styles.companyText}>
                        <Text variant="bodySm" weight="medium" truncate>{c.shortName}</Text>
                        <Text variant="caption" tone="tertiary" mono>{c.ticker ?? 'Private'}</Text>
                      </span>
                    </span>
                  </td>
                  <td>
                    <span className={styles.sector}>
                      <Swatch color={sectorColor(c.sector, tokens)} size="sm" />
                      <span>{c.sector}</span>
                    </span>
                  </td>
                  <td>{c.hq.city}, {c.hq.countryCode}</td>
                  <td className={styles.num}>{formatCompanyCap(c)}</td>
                  <td className={styles.num}>{m?.degree ?? 0}</td>
                  <td className={styles.num}>{formatDecimal(m?.betweenness ?? 0, 3)}</td>
                  {lenses && (
                    <>
                      <td className={styles.num}>{l ? Math.round(l.risk) : '—'}</td>
                      <td className={styles.num}>{l ? Math.round(l.opportunity) : '—'}</td>
                      <td className={styles.num}>{l && <Badge tone={STANCE_TONE[l.stance]} dot>{STANCE_META[l.stance].label}</Badge>}</td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
