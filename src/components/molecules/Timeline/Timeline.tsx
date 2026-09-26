import { ExternalLink } from 'lucide-react';
import { formatPartialDate } from '@/lib/format';
import { Icon, Text } from '../../atoms';
import styles from './Timeline.module.css';

export interface TimelineEvent {
  date: string;
  title: string;
  url?: string | null;
}

/** Vertical dated milestones, oldest first. */
export function Timeline({ events }: { events: TimelineEvent[] }) {
  return (
    <ol className={styles.timeline}>
      {events.map((e, i) => (
        <li key={`${e.date}-${i}`} className={styles.item}>
          <span className={styles.dot} aria-hidden />
          <Text as="time" variant="caption" tone="tertiary" mono className={styles.date}>
            {formatPartialDate(e.date)}
          </Text>
          <Text as="p" variant="bodySm">
            {e.url ? (
              <a href={e.url} target="_blank" rel="noreferrer noopener" className={styles.link}>
                {e.title}
                <Icon icon={ExternalLink} size="xs" className={styles.ext} />
              </a>
            ) : (
              e.title
            )}
          </Text>
        </li>
      ))}
    </ol>
  );
}
