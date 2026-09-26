import { useMemo } from 'react';
import type { FilteredData } from '@/data/filters';
import type { NetworkMetrics } from '@/data/metrics';
import { RELATIONSHIP_TYPES, SECTORS } from '@/data/schema';
import { useTheme } from '@/design-system';
import { communityColor, LENS_LABEL, lensColor, RELATIONSHIP_LABEL, relationshipColor, sectorColor } from '@/lib/colors';
import type { ColorBy, Lens } from '@/app/store';
import type { GraphPaint } from '@/lib/graph/overlays';
import { Legend, type LegendEntry } from '../../molecules';
import styles from './NetworkGraph.module.css';

/** Always-on legend so color never carries identity alone. Mirrors the active "Color by". */
export function GraphLegend({
  colorBy,
  lens = 'off',
  paint,
  filtered,
  metrics,
}: {
  colorBy: ColorBy;
  lens?: Lens;
  paint?: GraphPaint | null;
  filtered: FilteredData;
  metrics: NetworkMetrics;
}) {
  const { tokens } = useTheme();
  const entries = useMemo<LegendEntry[]>(() => {
    if (lens !== 'off') {
      const bands = ['Lowest fifth', 'Low', 'Middle', 'High', 'Highest fifth'];
      return bands.map((label, i) => ({ key: String(i), label, color: lensColor(lens, (i + 0.5) / bands.length, tokens) })).reverse();
    }
    if (colorBy === 'sector') {
      const counts = new Map<string, number>();
      for (const c of filtered.companies) counts.set(c.sector, (counts.get(c.sector) ?? 0) + 1);
      return SECTORS.filter((s) => counts.has(s)).map((s) => ({ key: s, label: s, color: sectorColor(s, tokens), value: counts.get(s) }));
    }
    if (colorBy === 'relationship') {
      const counts = new Map<string, number>();
      for (const r of filtered.relationships) counts.set(r.type, (counts.get(r.type) ?? 0) + 1);
      return RELATIONSHIP_TYPES.filter((t) => counts.has(t)).map((t) => ({
        key: t, label: RELATIONSHIP_LABEL[t], color: relationshipColor(t, tokens), value: counts.get(t),
      }));
    }
    const shown = metrics.communitySizes.slice(0, 8).map((size, i) => ({
      key: String(i), label: `Community ${i + 1}`, color: communityColor(i, tokens), value: size,
    }));
    const rest = metrics.communitySizes.slice(8).reduce((a, b) => a + b, 0);
    return rest ? [...shown, { key: 'other', label: 'Other communities', color: tokens.viz.other, value: rest }] : shown;
  }, [colorBy, lens, filtered, metrics, tokens]);

  if (paint) {
    return (
      <div className={styles.legend}>
        <Legend title={paint.legend.title} entries={paint.legend.entries} />
        <p className={styles.legendNote}>{paint.legend.note} Node size = market cap</p>
      </div>
    );
  }
  const title =
    lens !== 'off' ? `${LENS_LABEL[lens]} score` : colorBy === 'sector' ? 'Sector' : colorBy === 'relationship' ? 'Relationship' : 'Community';
  return (
    <div className={styles.legend}>
      <Legend title={title} entries={entries} shape={colorBy === 'relationship' && lens === 'off' ? 'line' : 'dot'} />
      <p className={styles.legendNote}>
        {lens !== 'off' && <>Ranked among companies in view. Tinted links drive the score. </>}
        Node size = market cap
      </p>
    </div>
  );
}
