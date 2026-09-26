import { useMemo } from 'react';
import { RotateCcw } from 'lucide-react';
import type { Company, Relationship, RelationshipType, Sector, Universe } from '@/data/schema';
import { RELATIONSHIP_TYPES, SECTORS, UNIVERSES } from '@/data/schema';
import type { Filters } from '@/data/filters';
import { isDefaultFilters } from '@/data/filters';
import type { ThemeTokens } from '@/design-system/tokens';
import { RELATIONSHIP_LABEL, relationshipColor, sectorColor } from '@/lib/colors';
import { formatMarketCap, formatPercent } from '@/lib/format';
import type { ColorBy, LayoutMode, Lens } from '@/app/store';
import { Button, Divider, Slider, Swatch, Toggle } from '../../atoms';
import { FilterGroup, SectionHeader, SegmentedControl } from '../../molecules';
import styles from './FilterPanel.module.css';

export interface FilterPanelProps {
  companies: Company[];
  relationships: Relationship[];
  filters: Filters;
  tokens: ThemeTokens;
  colorBy: ColorBy;
  /** Risk / Opportunity lens; replaces "Color by" while on. */
  lens?: Lens;
  onLens?: (l: Lens) => void;
  layoutMode: LayoutMode;
  showLabels: boolean;
  /** Show companies with no visible relationships. Hidden when the handler is omitted. */
  showIsolated?: boolean;
  onShowIsolated?: (v: boolean) => void;
  onColorBy: (c: ColorBy) => void;
  onLayoutMode: (m: LayoutMode) => void;
  onShowLabels: (v: boolean) => void;
  onToggleSector: (s: Sector) => void;
  onSetSectors: (s: Sector[]) => void;
  onToggleType: (t: RelationshipType) => void;
  onSetTypes: (t: RelationshipType[]) => void;
  onToggleUniverse: (u: Universe) => void;
  onSetUniverses: (u: Universe[]) => void;
  onMinMarketCap: (v: number) => void;
  onMinConfidence: (v: number) => void;
  onReset: () => void;
}

/** Market-cap slider steps (USD billions) — log-spaced so the long tail stays reachable. */
const CAP_STEPS = [0, 25, 50, 100, 200, 500, 1000, 2000];
const UNIVERSE_LABEL: Record<Universe, string> = { SP500: 'S&P 500', GLOBAL: 'Global listed', PRIVATE: 'Private' };

export function FilterPanel(p: FilterPanelProps) {
  const sectorCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of p.companies) m.set(c.sector, (m.get(c.sector) ?? 0) + 1);
    return m;
  }, [p.companies]);
  const typeCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of p.relationships) m.set(r.type, (m.get(r.type) ?? 0) + 1);
    return m;
  }, [p.relationships]);
  const universeCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of p.companies) m.set(c.universe, (m.get(c.universe) ?? 0) + 1);
    return m;
  }, [p.companies]);

  const capIndex = Math.max(0, CAP_STEPS.findIndex((v) => v >= p.filters.minMarketCap));

  return (
    <div className={styles.panel}>
      <section className={styles.section}>
        <SectionHeader title="View" />
        {p.onLens && (
          <div className={styles.field}>
            <span className={styles.fieldLabel} aria-hidden>Investor lens</span>
            <SegmentedControl
              label="Investor lens"
              fullWidth
              size="sm"
              value={p.lens ?? 'off'}
              onChange={p.onLens}
              options={[
                { value: 'off', label: 'Off' },
                { value: 'risk', label: 'Risk' },
                { value: 'opportunity', label: 'Opportunity' },
              ]}
            />
          </div>
        )}
        {p.lens && p.lens !== 'off' ? (
          <p className={styles.hint}>
            Nodes are colored by {p.lens} score, relative to the companies in view. Tinted links drive the score.
          </p>
        ) : (
          <SegmentedControl
            label="Color by"
            fullWidth
            size="sm"
            value={p.colorBy}
            onChange={p.onColorBy}
            options={[
              { value: 'sector', label: 'Sector' },
              { value: 'relationship', label: 'Relationship' },
              { value: 'community', label: 'Community' },
            ]}
          />
        )}
        <SegmentedControl
          label="Layout"
          fullWidth
          size="sm"
          value={p.layoutMode}
          onChange={p.onLayoutMode}
          options={[
            { value: 'network', label: 'Network' },
            { value: 'sector', label: 'By sector' },
          ]}
        />
        <Toggle checked={p.showLabels} onChange={p.onShowLabels} label="Show labels" />
        {p.onShowIsolated && (
          <Toggle checked={!!p.showIsolated} onChange={p.onShowIsolated} label="Show unconnected companies" />
        )}
      </section>

      <Divider />

      <section className={styles.section}>
        <SectionHeader
          title="Filters"
          action={
            !isDefaultFilters(p.filters) && (
              <Button size="sm" variant="ghost" leadingIcon={RotateCcw} onClick={p.onReset}>Reset</Button>
            )
          }
        />
        <Slider
          label="Min. market cap"
          value={capIndex}
          min={0}
          max={CAP_STEPS.length - 1}
          onChange={(i) => p.onMinMarketCap(CAP_STEPS[i])}
          format={(i) => (CAP_STEPS[i] === 0 ? 'Any' : `≥ ${formatMarketCap(CAP_STEPS[i])}`)}
        />
        <Slider
          label="Min. confidence"
          value={Math.round(p.filters.minConfidence * 100)}
          min={0}
          max={90}
          step={5}
          onChange={(v) => p.onMinConfidence(v / 100)}
          format={(v) => formatPercent(v / 100)}
        />
        <p className={styles.hint}>Below 50% includes links extracted automatically from SEC filings.</p>
      </section>

      <Divider />

      <FilterGroup
        title="Relationship"
        selected={p.filters.types}
        onToggle={p.onToggleType}
        onSetAll={p.onSetTypes}
        options={RELATIONSHIP_TYPES.filter((t) => typeCounts.has(t)).map((t) => ({
          value: t,
          label: RELATIONSHIP_LABEL[t],
          count: typeCounts.get(t),
          leading: <Swatch color={relationshipColor(t, p.tokens)} shape="line" size="sm" />,
        }))}
      />

      <Divider />

      <FilterGroup
        title="Sector"
        selected={p.filters.sectors}
        onToggle={p.onToggleSector}
        onSetAll={p.onSetSectors}
        options={SECTORS.filter((s) => sectorCounts.has(s)).map((s) => ({
          value: s,
          label: s,
          count: sectorCounts.get(s),
          leading: <Swatch color={sectorColor(s, p.tokens)} size="sm" />,
        }))}
      />

      <Divider />

      <FilterGroup
        title="Universe"
        selected={p.filters.universes}
        onToggle={p.onToggleUniverse}
        onSetAll={p.onSetUniverses}
        options={UNIVERSES.filter((u) => universeCounts.has(u)).map((u) => ({ value: u, label: UNIVERSE_LABEL[u], count: universeCounts.get(u) }))}
      />
    </div>
  );
}
