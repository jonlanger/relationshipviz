import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import clsx from 'clsx';
import { Search } from 'lucide-react';
import { Input, Kbd, Text, TickerMark } from '../../atoms';
import styles from './SearchField.module.css';

export interface SearchItem {
  id: string;
  ticker: string;
  label: string;
  sublabel?: string;
  color?: string;
  /** Extra strings to match against (aliases, full legal name). */
  keywords?: string[];
}

export interface SearchFieldProps {
  items: SearchItem[];
  onSelect: (id: string) => void;
  placeholder?: string;
  /** Global shortcut ("/") focuses the field. */
  hotkey?: boolean;
  maxResults?: number;
  className?: string;
}

function score(item: SearchItem, q: string): number {
  const t = item.ticker.toLowerCase();
  const l = item.label.toLowerCase();
  if (t === q) return 100;
  if (l === q) return 95;
  if (t.startsWith(q)) return 80;
  if (l.startsWith(q)) return 70;
  if (l.split(/\s+/).some((w) => w.startsWith(q))) return 50;
  if (item.keywords?.some((k) => k.toLowerCase().includes(q))) return 30;
  if (l.includes(q)) return 20;
  return 0;
}

/** Company typeahead, implemented as an ARIA combobox. */
export function SearchField({ items, onSelect, placeholder = 'Search companies', hotkey = true, maxResults = 8, className }: SearchFieldProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return items
      .map((item) => ({ item, s: score(item, q) }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, maxResults)
      .map((r) => r.item);
  }, [items, query, maxResults]);

  useEffect(() => setActive(0), [query]);

  useEffect(() => {
    if (!hotkey) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('input, textarea, [contenteditable]')) return;
      if (e.key === '/' || (e.key === 'k' && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hotkey]);

  const choose = (id: string) => {
    onSelect(id);
    setQuery('');
    setOpen(false);
    inputRef.current?.blur();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[active]) {
      e.preventDefault();
      choose(results[active].id);
    } else if (e.key === 'Escape') {
      setQuery('');
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  const showList = open && query.trim().length > 0;

  return (
    <div className={clsx(styles.root, className)}>
      <Input
        ref={inputRef}
        leadingIcon={Search}
        placeholder={placeholder}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKeyDown}
        trailing={hotkey && !query ? <Kbd>/</Kbd> : undefined}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && results[active] ? `${listId}-${results[active].id}` : undefined}
      />
      {showList && (
        <ul id={listId} role="listbox" className={styles.list}>
          {results.length === 0 ? (
            <li className={styles.empty}><Text variant="bodySm" tone="tertiary">No companies match “{query}”</Text></li>
          ) : (
            results.map((r, i) => (
              <li
                key={r.id}
                id={`${listId}-${r.id}`}
                role="option"
                aria-selected={i === active}
                className={clsx(styles.option, i === active && styles.active)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(r.id);
                }}
                onMouseEnter={() => setActive(i)}
              >
                <TickerMark ticker={r.ticker} color={r.color} size="sm" />
                <span className={styles.optionText}>
                  <Text variant="bodySm" weight="medium" truncate>{r.label}</Text>
                  {r.sublabel && <Text variant="caption" tone="tertiary" truncate>{r.sublabel}</Text>}
                </span>
                <Text variant="caption" tone="tertiary" mono>{r.ticker}</Text>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
