import type { Relationship, RelationshipType } from './schema';
import { SYMMETRIC_TYPES } from './schema';

export interface RawRelationship extends Omit<Relationship, 'type' | 'id'> {
  id?: string;
  type: RelationshipType | 'customer';
}

export const relationshipId = (source: string, type: RelationshipType, target: string) =>
  `${source}__${type}__${target}`.toLowerCase();

/**
 * Canonicalize a relationship:
 *  - `customer` (A is a customer of B) → `supplier` (B supplies A)
 *  - symmetric types get a stable ordering so A↔B and B↔A dedupe
 */
export function normalizeRelationship(raw: RawRelationship): Relationship {
  let { source, target } = raw;
  let type: RelationshipType;
  if (raw.type === 'customer') {
    type = 'supplier';
    [source, target] = [target, source];
  } else {
    type = raw.type;
  }
  if (SYMMETRIC_TYPES.has(type) && source > target) [source, target] = [target, source];
  return { ...raw, source, target, type, id: relationshipId(source, type, target) };
}

/**
 * Merge relationship lists. Earlier lists win on conflicts (pass curated first);
 * evidence from later lists is appended so provenance accumulates.
 */
export function mergeRelationships(...lists: RawRelationship[][]): Relationship[] {
  const byId = new Map<string, Relationship>();
  for (const list of lists) {
    for (const raw of list) {
      const r = normalizeRelationship(raw);
      const existing = byId.get(r.id);
      if (!existing) {
        byId.set(r.id, r);
        continue;
      }
      const urls = new Set(existing.evidence.map((e) => e.url + e.note));
      for (const e of r.evidence) if (!urls.has(e.url + e.note)) existing.evidence.push(e);
      existing.confidence = Math.max(existing.confidence, r.confidence);
    }
  }
  return [...byId.values()];
}
