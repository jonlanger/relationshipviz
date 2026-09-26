import { ExternalLink } from 'lucide-react';
import { Badge, Icon, Text } from '../../atoms';
import styles from './EvidenceSnippet.module.css';

export interface EvidenceSnippetProps {
  kind: 'curated' | 'filing' | 'press' | 'research';
  title?: string | null;
  publisher?: string | null;
  note: string;
  url: string;
  date?: string | null;
  heading?: string;
}

const KIND_LABEL = { curated: 'Curated', filing: 'SEC filing', press: 'Press release', research: 'Research' } as const;

export function EvidenceSnippet({ kind, note, url, date, heading }: EvidenceSnippetProps) {
  let host = url;
  try {
    host = new URL(url).hostname.replace(/^www\./, '');
  } catch {
    /* keep raw */
  }
  return (
    <figure className={styles.snippet}>
      {heading && <Text variant="bodySm" weight="medium">{heading}</Text>}
      {kind === 'filing' ? (
        <blockquote className={styles.quote}>{note}</blockquote>
      ) : (
        <Text as="p" variant="bodySm" tone="secondary">{note}</Text>
      )}
      <figcaption className={styles.meta}>
        <Badge tone={kind === 'curated' ? 'accent' : 'neutral'}>{KIND_LABEL[kind]}</Badge>
        {date && <Text variant="caption" tone="tertiary">{date}</Text>}
        <a className={styles.link} href={url} target="_blank" rel="noreferrer noopener">
          {host}
          <Icon icon={ExternalLink} size="xs" />
        </a>
      </figcaption>
    </figure>
  );
}
