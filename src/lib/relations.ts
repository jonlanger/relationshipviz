import type { Relationship } from '@/data/schema';
import { SYMMETRIC_TYPES } from '@/data/schema';
import { RELATIONSHIP_VERB } from './colors';

/** Direction-aware grouping of a company's relationships, from that company's point of view. */
export type RelationGroup =
  | 'suppliers'
  | 'customers'
  | 'partners'
  | 'competitors'
  | 'backers'
  | 'investments'
  | 'parents'
  | 'subsidiaries';

export const RELATION_GROUP_ORDER: RelationGroup[] = [
  'suppliers',
  'customers',
  'partners',
  'competitors',
  'backers',
  'investments',
  'parents',
  'subsidiaries',
];

export const RELATION_GROUP_LABEL: Record<RelationGroup, string> = {
  suppliers: 'Suppliers',
  customers: 'Customers',
  partners: 'Partners',
  competitors: 'Competitors',
  backers: 'Backed by',
  investments: 'Investments',
  parents: 'Owned by',
  subsidiaries: 'Subsidiaries',
};

export interface RelationView {
  otherId: string;
  group: RelationGroup;
  /** Verb phrase from the focus company's side, e.g. "Supplies", "Supplied by". */
  verb: string;
  direction: 'out' | 'in' | 'both';
}

export function viewRelation(r: Relationship, companyId: string): RelationView {
  const out = r.source === companyId;
  const otherId = out ? r.target : r.source;
  if (SYMMETRIC_TYPES.has(r.type)) {
    return { otherId, group: r.type === 'partner' ? 'partners' : 'competitors', verb: RELATIONSHIP_VERB[r.type][0], direction: 'both' };
  }
  const verb = RELATIONSHIP_VERB[r.type][out ? 0 : 1];
  const direction = out ? 'out' : 'in';
  switch (r.type) {
    case 'supplier':
      return { otherId, group: out ? 'customers' : 'suppliers', verb, direction };
    case 'investor':
      return { otherId, group: out ? 'investments' : 'backers', verb, direction };
    default:
      return { otherId, group: out ? 'parents' : 'subsidiaries', verb, direction };
  }
}

export function groupRelations<T extends Relationship>(rels: T[], companyId: string) {
  const map = new Map<RelationGroup, { rel: T; view: RelationView }[]>();
  for (const rel of rels) {
    const view = viewRelation(rel, companyId);
    const list = map.get(view.group) ?? [];
    list.push({ rel, view });
    map.set(view.group, list);
  }
  for (const list of map.values()) list.sort((a, b) => b.rel.weight - a.rel.weight);
  return RELATION_GROUP_ORDER.filter((g) => map.has(g)).map((g) => ({ group: g, label: RELATION_GROUP_LABEL[g], items: map.get(g)! }));
}
