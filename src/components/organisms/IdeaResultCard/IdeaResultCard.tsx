import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button, Icon, Text, TickerMark } from '../../atoms';
import styles from './IdeaResultCard.module.css';

export interface IdeaResultCardProps {
  rank: number;
  ticker: string;
  name: string;
  sublabel: string;
  tickerColor?: string;
  /** 0–100. */
  fit: number;
  reasons: string[];
  watchouts: string[];
  onOpen?: () => void;
  onGraph?: () => void;
  openLabel?: string;
}

/** One idea to research: why it matched, and what to watch. */
export function IdeaResultCard({ rank, ticker, name, sublabel, tickerColor, fit, reasons, watchouts, onOpen, onGraph, openLabel = 'Profile' }: IdeaResultCardProps) {
  const score = Math.round(fit);
  return (
    <article className={styles.card} aria-label={`${rank}. ${name}, fit ${score} of 100`}>
      <header className={styles.head}>
        <span className={styles.rank}>{rank}</span>
        <TickerMark ticker={ticker} color={tickerColor} size="md" />
        <span className={styles.names}>
          <Text variant="bodySm" weight="semibold" truncate>{name}</Text>
          <Text variant="caption" tone="tertiary" truncate>{sublabel}</Text>
        </span>
        <span className={styles.fit}>
          <span className={styles.fitValue}>{score}</span>
          <span className={styles.fitLabel}>fit</span>
        </span>
      </header>
      <span className={styles.track} aria-hidden><span className={styles.fill} style={{ width: `${Math.max(2, score)}%` }} /></span>
      {reasons.length > 0 && (
        <ul className={styles.list} aria-label="Why it matched">
          {reasons.map((r) => (
            <li key={r} className={styles.item}><Icon icon={CheckCircle2} size="xs" className={styles.good} /> <span>{r}</span></li>
          ))}
        </ul>
      )}
      {watchouts.length > 0 && (
        <ul className={styles.list} aria-label="Watch-outs">
          {watchouts.map((w) => (
            <li key={w} className={styles.item}><Icon icon={AlertTriangle} size="xs" className={styles.warn} /> <span>{w}</span></li>
          ))}
        </ul>
      )}
      {(onOpen || onGraph) && (
        <footer className={styles.actions}>
          {onOpen && <Button size="sm" variant="secondary" onClick={onOpen}>{openLabel}</Button>}
          {onGraph && <Button size="sm" variant="ghost" onClick={onGraph}>View in graph</Button>}
        </footer>
      )}
    </article>
  );
}
