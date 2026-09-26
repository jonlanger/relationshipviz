import { useEffect, useMemo } from 'react';
import { applyFilters, DEFAULT_FILTERS, type FilteredData } from '@/data/filters';
import { computeMetrics, type NetworkMetrics } from '@/data/metrics';
import { computeLenses, type LensResult } from '@/data/lenses';
import type { Fund } from '@/data/funds';
import { runScenario, type ScenarioResult, type Shock } from '@/data/scenarios';
import { SCENARIO_PRESETS } from '@/data/scenarioPresets';
import { analyzePortfolio, type PortfolioAnalysis } from '@/data/portfolio';
import type { Company, Dataset } from '@/data/schema';
import { useAppStore } from './useAppStore';

/** Loads the dataset once and returns it (null while loading). */
export function useDataset(): { dataset: Dataset | null; status: string; error: string | null } {
  const { dataset, status, error, load } = useAppStore();
  useEffect(() => {
    void load();
  }, [load]);
  return { dataset, status, error };
}

export function useFilteredData(): FilteredData | null {
  const dataset = useAppStore((s) => s.dataset);
  const filters = useAppStore((s) => s.filters);
  return useMemo(() => (dataset ? applyFilters(dataset, filters) : null), [dataset, filters]);
}

export function useMetrics(filtered: FilteredData | null): NetworkMetrics | null {
  return useMemo(() => (filtered ? computeMetrics(filtered.companies, filtered.relationships) : null), [filtered]);
}

export function useCompanyIndex(): Map<string, Company> {
  const dataset = useAppStore((s) => s.dataset);
  return useMemo(() => new Map(dataset?.companies.map((c) => [c.id, c]) ?? []), [dataset]);
}

/** Risk & opportunity scores for the filtered universe, with the user's factor weights. */
export function useLenses(filtered: FilteredData | null, metrics: NetworkMetrics | null): LensResult | null {
  const weights = useAppStore((s) => s.lensWeights);
  return useMemo(
    () => (filtered && metrics ? computeLenses(filtered.companies, filtered.relationships, metrics, weights) : null),
    [filtered, metrics, weights],
  );
}

/** Fund holdings (lazy-loaded) keyed by ticker. Empty until loaded. */
export function useFunds(): { funds: Map<string, Fund>; status: string; list: Fund[] } {
  const file = useAppStore((s) => s.funds);
  const status = useAppStore((s) => s.fundsStatus);
  const load = useAppStore((s) => s.loadFunds);
  useEffect(() => {
    void load();
  }, [load]);
  return useMemo(() => ({ funds: new Map(file?.funds.map((f) => [f.ticker, f]) ?? []), list: file?.funds ?? [], status }), [file, status]);
}

/** The active scenario's shock, from a preset or the custom definition. */
export function useScenarioShock(): { shock: Shock; label: string; description: string } {
  const choice = useAppStore((s) => s.scenario);
  return useMemo(() => {
    if ('custom' in choice) return { shock: choice.custom, label: 'Custom scenario', description: 'Your own shock.' };
    const p = SCENARIO_PRESETS.find((x) => x.id === choice.preset) ?? SCENARIO_PRESETS[0];
    return { shock: p.shock, label: p.label, description: p.description };
  }, [choice]);
}

/** Scenario result over the filtered universe. */
export function useScenario(filtered: FilteredData | null): ScenarioResult | null {
  const { shock } = useScenarioShock();
  return useMemo(() => (filtered ? runScenario(shock, filtered.companies, filtered.relationships) : null), [filtered, shock]);
}

/**
 * The viewer's portfolio, analyzed against every company (not the Explore filters) and the
 * relationships that pass the default confidence bar, with lens scores over the full universe.
 */
export function usePortfolio(): { analysis: PortfolioAnalysis | null; lenses: LensResult | null; fundsStatus: string } {
  const dataset = useAppStore((s) => s.dataset);
  const positions = useAppStore((s) => s.positions);
  const weights = useAppStore((s) => s.lensWeights);
  const { funds, status } = useFunds();
  const base = useMemo(() => {
    if (!dataset) return null;
    const relationships = dataset.relationships.filter((r) => r.confidence >= DEFAULT_FILTERS.minConfidence);
    const metrics = computeMetrics(dataset.companies, relationships);
    return { relationships, lenses: computeLenses(dataset.companies, relationships, metrics, weights) };
  }, [dataset, weights]);
  const analysis = useMemo(
    () => (dataset && base ? analyzePortfolio(positions, dataset.companies, base.relationships, funds, base.lenses) : null),
    [dataset, base, positions, funds],
  );
  return { analysis, lenses: base?.lenses ?? null, fundsStatus: status };
}
