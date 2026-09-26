import { create } from 'zustand';
import type { Dataset, RelationshipType, Sector, Universe } from '@/data/schema';
import { DEFAULT_FILTERS, type Filters } from '@/data/filters';
import { loadDataset, loadFunds } from '@/data/loader';
import type { FundsFile } from '@/data/funds';
import type { Position } from '@/data/portfolio';
import type { Shock } from '@/data/scenarios';
import { DEFAULT_ANSWERS, type IdeaAnswers } from '@/data/ideas';
import { DEFAULT_LENS_WEIGHTS, type FactorKey, type LensKind, type LensWeights } from '@/data/lenses';

export type ColorBy = 'sector' | 'relationship' | 'community';
export type LayoutMode = 'network' | 'sector';
export type Lens = 'off' | LensKind;
/** Graph overlay; takes precedence over the lens and "Color by". */
export type Overlay = 'none' | 'portfolio' | 'scenario';

/** A scenario is a preset id, or a custom shock. */
export type ScenarioChoice = { preset: string } | { custom: Shock };

interface DataSlice {
  status: 'idle' | 'loading' | 'ready' | 'error';
  dataset: Dataset | null;
  error: string | null;
  load: () => Promise<void>;
  funds: FundsFile | null;
  fundsStatus: 'idle' | 'loading' | 'ready' | 'error';
  loadFunds: () => Promise<void>;
}

interface UiSlice {
  filters: Filters;
  selectedId: string | null;
  /** Selected company pair (graph edge key, "A|B"). Takes precedence over selectedId in the drawer. */
  selectedEdge: string | null;
  /** Company the user drilled into the relationship from, for "back" navigation. */
  edgeOrigin: string | null;
  hoveredId: string | null;
  colorBy: ColorBy;
  layoutMode: LayoutMode;
  showLabels: boolean;
  filtersOpen: boolean;
  /** Risk / Opportunity lens on the graph. Overrides "Color by" while on. */
  lens: Lens;
  lensWeights: LensWeights;
  /** Also show companies with no visible relationships in the graph. */
  showIsolated: boolean;
  overlay: Overlay;
  scenario: ScenarioChoice;
  /** The viewer's positions. Kept in this browser only (localStorage); never sent anywhere. */
  positions: Position[];
  ideaAnswers: IdeaAnswers;
  select: (id: string | null) => void;
  selectEdge: (key: string | null, origin?: string | null) => void;
  hover: (id: string | null) => void;
  setColorBy: (c: ColorBy) => void;
  setLayoutMode: (m: LayoutMode) => void;
  setShowLabels: (v: boolean) => void;
  setFiltersOpen: (v: boolean) => void;
  toggleSector: (s: Sector) => void;
  toggleType: (t: RelationshipType) => void;
  toggleUniverse: (u: Universe) => void;
  setSectors: (s: Sector[]) => void;
  setTypes: (t: RelationshipType[]) => void;
  setUniverses: (u: Universe[]) => void;
  setMinMarketCap: (v: number) => void;
  setMinConfidence: (v: number) => void;
  /** Show only one sector — used by chart → graph navigation. */
  focusSector: (s: Sector) => void;
  resetFilters: () => void;
  setLens: (l: Lens) => void;
  setLensWeight: (kind: LensKind, factor: FactorKey, weight: number) => void;
  resetLensWeights: (kind?: LensKind) => void;
  setShowIsolated: (v: boolean) => void;
  setOverlay: (o: Overlay) => void;
  setScenario: (s: ScenarioChoice) => void;
  setPositions: (p: Position[]) => void;
  setIdeaAnswers: (a: Partial<IdeaAnswers>) => void;
}

/** Filters start open on desktop, closed on narrow screens where the panel overlays the graph. */
const wideScreen = () => {
  try {
    return window.matchMedia('(min-width: 901px)').matches;
  } catch {
    return true;
  }
};

const POSITIONS_KEY = 'relationshipviz.positions';
function readPositions(): Position[] {
  try {
    const raw = window.localStorage.getItem(POSITIONS_KEY);
    const list = raw ? (JSON.parse(raw) as Position[]) : [];
    return Array.isArray(list) ? list.filter((p) => p && (p.kind === 'stock' || p.kind === 'fund') && typeof p.id === 'string' && p.amount > 0) : [];
  } catch {
    return [];
  }
}
function writePositions(p: Position[]) {
  try {
    window.localStorage.setItem(POSITIONS_KEY, JSON.stringify(p));
  } catch {
    // Storage can be unavailable (private mode); positions then last for the session only.
  }
}

const toggle = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

export const useAppStore = create<DataSlice & UiSlice>((set, get) => ({
  status: 'idle',
  dataset: null,
  error: null,
  load: async () => {
    if (get().status === 'loading' || get().status === 'ready') return;
    set({ status: 'loading', error: null });
    try {
      set({ dataset: await loadDataset(), status: 'ready' });
    } catch (e) {
      set({ status: 'error', error: (e as Error).message });
    }
  },

  funds: null,
  fundsStatus: 'idle',
  loadFunds: async () => {
    if (get().fundsStatus === 'loading' || get().fundsStatus === 'ready') return;
    set({ fundsStatus: 'loading' });
    try {
      set({ funds: await loadFunds(), fundsStatus: 'ready' });
    } catch {
      set({ fundsStatus: 'error' });
    }
  },

  filters: DEFAULT_FILTERS,
  selectedId: null,
  selectedEdge: null,
  edgeOrigin: null,
  hoveredId: null,
  colorBy: 'sector',
  layoutMode: 'network',
  showLabels: true,
  filtersOpen: wideScreen(),
  lens: 'off',
  lensWeights: DEFAULT_LENS_WEIGHTS,
  showIsolated: false,
  overlay: 'none',
  scenario: { preset: 'taiwan' },
  positions: readPositions(),
  ideaAnswers: DEFAULT_ANSWERS,
  // Selecting swaps the drawer content, so rows under the pointer never get mouseleave — clear hover.
  select: (selectedId) => set({ selectedId, selectedEdge: null, edgeOrigin: null, hoveredId: null }),
  selectEdge: (selectedEdge, origin = null) =>
    set(({ selectedId }) => ({ selectedEdge, edgeOrigin: selectedEdge ? origin ?? selectedId : null, hoveredId: null })),
  hover: (hoveredId) => set({ hoveredId }),
  setColorBy: (colorBy) => set({ colorBy }),
  setLayoutMode: (layoutMode) => set({ layoutMode }),
  setShowLabels: (showLabels) => set({ showLabels }),
  setFiltersOpen: (filtersOpen) => set({ filtersOpen }),
  toggleSector: (s) => set(({ filters }) => ({ filters: { ...filters, sectors: toggle(filters.sectors, s) } })),
  toggleType: (t) => set(({ filters }) => ({ filters: { ...filters, types: toggle(filters.types, t) } })),
  toggleUniverse: (u) => set(({ filters }) => ({ filters: { ...filters, universes: toggle(filters.universes, u) } })),
  setSectors: (sectors) => set(({ filters }) => ({ filters: { ...filters, sectors } })),
  setTypes: (types) => set(({ filters }) => ({ filters: { ...filters, types } })),
  setUniverses: (universes) => set(({ filters }) => ({ filters: { ...filters, universes } })),
  setMinMarketCap: (minMarketCap) => set(({ filters }) => ({ filters: { ...filters, minMarketCap } })),
  setMinConfidence: (minConfidence) => set(({ filters }) => ({ filters: { ...filters, minConfidence } })),
  focusSector: (s) => set(({ filters }) => ({ filters: { ...filters, sectors: [s] }, selectedId: null, selectedEdge: null })),
  resetFilters: () => set({ filters: DEFAULT_FILTERS }),
  setLens: (lens) => set({ lens }),
  setLensWeight: (kind, factor, weight) =>
    set(({ lensWeights }) => ({ lensWeights: { ...lensWeights, [kind]: { ...lensWeights[kind], [factor]: weight } } })),
  setShowIsolated: (showIsolated) => set({ showIsolated }),
  setOverlay: (overlay) => set({ overlay }),
  setScenario: (scenario) => set({ scenario }),
  setPositions: (positions) => {
    writePositions(positions);
    set({ positions });
  },
  setIdeaAnswers: (a) => set(({ ideaAnswers }) => ({ ideaAnswers: { ...ideaAnswers, ...a } })),
  resetLensWeights: (kind) =>
    set(({ lensWeights }) => ({
      lensWeights: kind ? { ...lensWeights, [kind]: DEFAULT_LENS_WEIGHTS[kind] } : DEFAULT_LENS_WEIGHTS,
    })),
}));
