import type { ThemeTokens } from '@/design-system/tokens';
import { SECTORS, RELATIONSHIP_TYPES, type RelationshipType, type Sector } from '@/data/schema';
import type { LensKind, Stance } from '@/data/lenses';

/**
 * Color follows the entity, never its rank: sectors keep a fixed slot regardless of filters.
 * The palette has 8 validated slots; the three smallest sectors fold into "other".
 */
const SECTOR_SLOT: Record<Sector, number | null> = Object.fromEntries(
  SECTORS.map((s, i) => [s, i < 8 ? i : null]),
) as Record<Sector, number | null>;

export function sectorColor(sector: Sector, t: ThemeTokens): string {
  const slot = SECTOR_SLOT[sector];
  return slot == null ? t.viz.other : t.viz.series[slot];
}

/** Relationship types use their own fixed slots. Only shown when "Color by: Relationship" is active. */
const TYPE_SLOT: Record<RelationshipType, number> = {
  supplier: 0,
  partner: 2,
  investor: 3,
  competitor: 7,
  subsidiary: 6,
};
export function relationshipColor(type: RelationshipType, t: ThemeTokens): string {
  return t.viz.series[TYPE_SLOT[type]];
}

export const RELATIONSHIP_LABEL: Record<RelationshipType, string> = {
  supplier: 'Supplier',
  partner: 'Partner',
  investor: 'Investor',
  competitor: 'Competitor',
  subsidiary: 'Subsidiary',
};

/** Verb phrase from the source's point of view, for sentences like "TSMC supplies Apple". */
export const RELATIONSHIP_VERB: Record<RelationshipType, [outgoing: string, incoming: string]> = {
  supplier: ['Supplies', 'Supplied by'],
  partner: ['Partners with', 'Partners with'],
  investor: ['Invests in', 'Backed by'],
  competitor: ['Competes with', 'Competes with'],
  subsidiary: ['Owned by', 'Owns'],
};

export const ALL_TYPES = RELATIONSHIP_TYPES;

/** Community colors: first 8 communities by size get slots; the rest fold to "other". */
export function communityColor(rank: number, t: ThemeTokens): string {
  return rank < 8 ? t.viz.series[rank] : t.viz.other;
}

/** Sequential ramp lookup, 0–1 → color. */
export function sequentialColor(v: number, t: ThemeTokens): string {
  const ramp = t.viz.sequential;
  const i = Math.min(ramp.length - 1, Math.max(0, Math.floor(v * ramp.length)));
  return ramp[i];
}

/** Lens ramp lookup: a 0–1 percentile → one of the 5 ordinal steps (low → high score). */
export function lensColor(kind: LensKind, v: number, t: ThemeTokens): string {
  const ramp = kind === 'risk' ? t.viz.risk : t.viz.opportunity;
  return ramp[Math.min(ramp.length - 1, Math.max(0, Math.floor(v * ramp.length)))];
}

/** Stance uses the reserved status colors and always ships with its label. */
export function stanceColor(s: Stance, t: ThemeTokens): string {
  return s === 'add' ? t.status.good : s === 'watch' ? t.status.warning : s === 'reduce' ? t.status.critical : t.viz.neutralNode;
}

/** Badge tone per stance — the same reserved status roles as `stanceColor`. */
export const STANCE_TONE: Record<Stance, 'good' | 'warning' | 'critical' | 'neutral'> = {
  add: 'good',
  watch: 'warning',
  reduce: 'critical',
  hold: 'neutral',
};

export const LENS_LABEL: Record<LensKind, string> = { risk: 'Risk', opportunity: 'Opportunity' };
