import { Lock, Trash2 } from 'lucide-react';
import type { Company } from '@/data/schema';
import type { Fund } from '@/data/funds';
import type { Position } from '@/data/portfolio';
import type { ThemeTokens } from '@/design-system/tokens';
import { sectorColor } from '@/lib/colors';
import { Badge, Button, Icon, IconButton, Text, TickerMark } from '../../atoms';
import { SearchField, SectionHeader, type SearchItem } from '../../molecules';
import styles from './PositionInput.module.css';

export interface PositionInputProps {
  positions: Position[];
  onChange: (p: Position[]) => void;
  companyIndex: Map<string, Company>;
  searchItems: SearchItem[];
  funds: Fund[];
  tokens: ThemeTokens;
  examples?: { label: string; positions: Position[] }[];
}

/** Add stocks and funds with an amount each. Amounts only matter relative to each other. */
export function PositionInput({ positions, onChange, companyIndex, searchItems, funds, tokens, examples = [] }: PositionInputProps) {
  const add = (p: Position) => {
    if (positions.some((x) => x.kind === p.kind && x.id === p.id)) return;
    onChange([...positions, p]);
  };
  const update = (i: number, amount: number) => onChange(positions.map((p, j) => (j === i ? { ...p, amount } : p)));
  const remove = (i: number) => onChange(positions.filter((_, j) => j !== i));
  const fundBy = new Map(funds.map((f) => [f.ticker, f]));
  const total = positions.reduce((a, p) => a + (p.amount > 0 ? p.amount : 0), 0);

  return (
    <div className={styles.root}>
      <div className={styles.adders}>
        <SearchField items={searchItems} hotkey={false} placeholder="Add a stock…" onSelect={(id) => add({ kind: 'stock', id, amount: 1000 })} />
        <select
          className={styles.select}
          aria-label="Add a fund"
          value=""
          onChange={(e) => e.target.value && add({ kind: 'fund', id: e.target.value, amount: 1000 })}
        >
          <option value="">Add a fund or ETF…</option>
          {funds.map((f) => (
            <option key={f.ticker} value={f.ticker} disabled={!f.holdings.length}>
              {f.ticker} · {f.name}{f.holdings.length ? '' : ' (holdings unavailable)'}
            </option>
          ))}
        </select>
      </div>

      {positions.length === 0 ? (
        <div className={styles.empty}>
          <Text as="p" variant="bodySm" tone="secondary">Add what you hold, or try an example.</Text>
          <div className={styles.examples}>
            {examples.map((e) => (
              <Button key={e.label} size="sm" variant="secondary" onClick={() => onChange(e.positions)}>{e.label}</Button>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <SectionHeader title={`Positions · ${positions.length}`} action={<Button size="sm" variant="ghost" onClick={() => onChange([])}>Clear all</Button>} />
          <ul className={styles.list}>
            {positions.map((p, i) => {
              const c = p.kind === 'stock' ? companyIndex.get(p.id) : undefined;
              const f = p.kind === 'fund' ? fundBy.get(p.id) : undefined;
              const label = c?.shortName ?? f?.name ?? p.id;
              return (
                <li key={`${p.kind}:${p.id}`} className={styles.row}>
                  <TickerMark ticker={c?.ticker ?? p.id} color={c ? sectorColor(c.sector, tokens) : undefined} size="sm" />
                  <span className={styles.name}>
                    <Text variant="bodySm" weight="medium" truncate>{label}</Text>
                    <span className={styles.meta}>
                      <Badge>{p.kind === 'fund' ? (f?.kind === 'mutual' ? 'Mutual fund' : 'ETF') : 'Stock'}</Badge>
                      <Text variant="caption" tone="tertiary">{total > 0 ? `${Math.round((p.amount / total) * 100)}%` : ''}</Text>
                    </span>
                  </span>
                  <input
                    className={styles.amount}
                    type="number"
                    min={0}
                    step="any"
                    inputMode="decimal"
                    aria-label={`Amount in ${label}`}
                    value={p.amount}
                    onChange={(e) => update(i, Math.max(0, Number(e.target.value) || 0))}
                  />
                  <IconButton icon={Trash2} label={`Remove ${label}`} onClick={() => remove(i)} />
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <p className={styles.privacy}>
        <Icon icon={Lock} size="xs" /> Stays in this browser. Nothing is uploaded. Amounts only matter relative to each other: use dollars, shares × price or percentages.
      </p>
    </div>
  );
}
