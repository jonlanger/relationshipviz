import clsx from 'clsx';
import { Network } from 'lucide-react';
import type { Company, Sector } from '@/data/schema';
import { SECTORS } from '@/data/schema';
import type { ScenarioResult, Shock, ShockMode } from '@/data/scenarios';
import type { ThemeTokens } from '@/design-system/tokens';
import { sectorColor } from '@/lib/colors';
import { Button, Slider, Text } from '../../atoms';
import { ConnectionRow, SearchField, SectionHeader, SegmentedControl, StatTile, type SearchItem } from '../../molecules';
import styles from './ScenarioPanel.module.css';

export type ScenarioValue = { preset: string } | { custom: Shock };

export interface ScenarioPanelProps {
  presets: { id: string; label: string; description: string; shock: Shock }[];
  value: ScenarioValue;
  onChange: (v: ScenarioValue) => void;
  result: ScenarioResult;
  companyIndex: Map<string, Company>;
  tokens: ThemeTokens;
  /** For the custom company picker. */
  searchItems: SearchItem[];
  /** Countries that have companies in view, for the custom country picker. */
  countries: { code: string; label: string }[];
  /** Exposure-weighted impact on the viewer's portfolio, 0–1, when they have one. */
  portfolioImpact?: number | null;
  onShowOnGraph: () => void;
  onSelectCompany: (id: string) => void;
  className?: string;
}

const ROLE_TEXT: Record<string, string> = {
  supplier: 'loses supply from',
  customer: 'loses sales to',
  partner: 'partner of',
  investee: 'holds a stake in',
  investor: 'backed by',
  parent: 'owned by',
  subsidiary: 'owns',
};

/** Pick or build a shock, and see how it travels through the network. */
export function ScenarioPanel({
  presets,
  value,
  onChange,
  result,
  companyIndex,
  tokens,
  searchItems,
  countries,
  portfolioImpact,
  onShowOnGraph,
  onSelectCompany,
  className,
}: ScenarioPanelProps) {
  const name = (id: string) => companyIndex.get(id)?.shortName ?? id;
  const custom = 'custom' in value ? value.custom : null;
  const active = 'preset' in value ? presets.find((p) => p.id === value.preset) : null;
  const setCustom = (patch: Partial<Shock>) =>
    onChange({ custom: { ...(custom ?? { target: { kind: 'company', ids: [] }, mode: 'disruption', severity: 0.6 }), ...patch } });

  const impacted = [...result.impacts.values()].filter((i) => i.hop > 0).sort((a, b) => b.impact - a.impact);
  const shown = impacted.slice(0, 10);

  return (
    <div className={clsx(styles.panel, className)}>
      <div className={styles.controls}>
        <SectionHeader title="Scenario" />
        <div className={styles.presets} role="radiogroup" aria-label="Scenario">
          {presets.map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={active?.id === p.id}
              className={clsx(styles.preset, active?.id === p.id && styles.presetActive)}
              onClick={() => onChange({ preset: p.id })}
            >
              <span className={styles.presetLabel}>{p.label}</span>
              <span className={styles.presetDesc}>{p.description}</span>
            </button>
          ))}
          <button
            type="button"
            role="radio"
            aria-checked={!!custom}
            className={clsx(styles.preset, custom && styles.presetActive)}
            onClick={() => !custom && setCustom({})}
          >
            <span className={styles.presetLabel}>Build your own</span>
            <span className={styles.presetDesc}>Pick companies, a country or a sector, and how hard they’re hit.</span>
          </button>
        </div>

        {custom && (
          <div className={styles.custom}>
            <SegmentedControl
              size="sm"
              fullWidth
              label="Shock target"
              value={custom.target.kind}
              onChange={(kind) =>
                setCustom({
                  target:
                    kind === 'company'
                      ? { kind, ids: [] }
                      : kind === 'country'
                        ? { kind, code: countries[0]?.code ?? 'TW' }
                        : { kind, sector: 'Energy' as Sector },
                })
              }
              options={[
                { value: 'company', label: 'Companies' },
                { value: 'country', label: 'Country' },
                { value: 'sector', label: 'Sector' },
              ]}
            />
            {custom.target.kind === 'company' && (
              <>
                <SearchField
                  items={searchItems}
                  hotkey={false}
                  placeholder="Add a company…"
                  onSelect={(id) =>
                    custom.target.kind === 'company' &&
                    !custom.target.ids.includes(id) &&
                    setCustom({ target: { kind: 'company', ids: [...custom.target.ids, id] } })
                  }
                />
                {custom.target.ids.length > 0 && (
                  <div className={styles.chips}>
                    {custom.target.ids.map((id) => (
                      <button
                        key={id}
                        type="button"
                        className={styles.chip}
                        aria-label={`Remove ${name(id)}`}
                        onClick={() =>
                          custom.target.kind === 'company' &&
                          setCustom({ target: { kind: 'company', ids: custom.target.ids.filter((x) => x !== id) } })
                        }
                      >
                        {name(id)} ×
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
            {custom.target.kind === 'country' && (
              <select
                className={styles.select}
                aria-label="Country"
                value={custom.target.code}
                onChange={(e) => setCustom({ target: { kind: 'country', code: e.target.value } })}
              >
                {countries.map((c) => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
            )}
            {custom.target.kind === 'sector' && (
              <select
                className={styles.select}
                aria-label="Sector"
                value={custom.target.sector}
                onChange={(e) => setCustom({ target: { kind: 'sector', sector: e.target.value as Sector } })}
              >
                {SECTORS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            )}
            <SegmentedControl<ShockMode>
              size="sm"
              fullWidth
              label="Kind of shock"
              value={custom.mode}
              onChange={(mode) => setCustom({ mode })}
              options={[
                { value: 'disruption', label: 'Can’t deliver' },
                { value: 'demand', label: 'Spends less' },
              ]}
            />
            <Slider
              label="Severity"
              value={Math.round(custom.severity * 100)}
              min={10}
              max={100}
              step={10}
              onChange={(v) => setCustom({ severity: v / 100 })}
              format={(v) => `${v}%`}
            />
          </div>
        )}
      </div>

      <div className={styles.results}>
        <div className={styles.kpis}>
          <StatTile label="Hit directly" value={result.shocked.length} caption={result.shocked.slice(0, 3).map(name).join(', ') || 'No companies match'} />
          <StatTile label="Knock-on effects" value={impacted.length} caption={`${impacted.filter((i) => i.impact >= 0.3).length} heavily`} />
          {portfolioImpact != null && (
            <StatTile label="Your portfolio" value={`${Math.round(portfolioImpact * 100)}%`} caption="Exposure-weighted impact" />
          )}
        </div>
        <SectionHeader
          title="Most affected"
          action={<Button size="sm" variant="secondary" leadingIcon={Network} onClick={onShowOnGraph}>Show on graph</Button>}
        />
        {shown.length === 0 ? (
          <Text tone="tertiary" variant="bodySm">No knock-on effects among the companies in view.</Text>
        ) : (
          <div>
            {shown.map((i) => {
              const c = companyIndex.get(i.id);
              const last = i.path[i.path.length - 1];
              return (
                <ConnectionRow
                  key={i.id}
                  ticker={c?.ticker ?? c?.shortName ?? i.id}
                  name={c?.shortName ?? i.id}
                  color={c && sectorColor(c.sector, tokens)}
                  relation={`${Math.round(i.impact * 100)}% · ${ROLE_TEXT[last.role] ?? 'tied to'} ${name(last.from)}`}
                  hint={i.hop > 1 ? `${i.hop} steps from the shock` : undefined}
                  direction="in"
                  weight={i.impact}
                  onClick={() => onSelectCompany(i.id)}
                />
              );
            })}
          </div>
        )}
        {result.beneficiaries.length > 0 && (
          <>
            <SectionHeader title="Competitors that may gain share" />
            <Text as="p" variant="bodySm" tone="secondary">
              {result.beneficiaries.slice(0, 6).map((b) => `${name(b.id)} (vs ${name(b.via)})`).join(' · ')}
            </Text>
          </>
        )}
        <Text as="p" variant="caption" tone="tertiary">
          A rough map of who’s exposed and through which links, not a forecast of prices or earnings.
        </Text>
      </div>
    </div>
  );
}
