/**
 * Graph overlays: precomputed node and link colors for the Explore graph when it shows a
 * portfolio or a scenario instead of sectors or lenses. Pages build a GraphPaint; the graph
 * paints whatever it's given and dims everything else.
 */
import type { ThemeTokens } from '@/design-system/tokens';
import type { PortfolioAnalysis } from '@/data/portfolio';
import type { ScenarioResult } from '@/data/scenarios';
import { lensColor } from '@/lib/colors';

export interface GraphPaint {
  /** Painted nodes; `strong` ones get a forced label and sit on top. Unlisted nodes are dimmed. */
  nodes: Map<string, { color: string; strong?: boolean }>;
  /** Painted relationships by id. Unlisted links fade. */
  edges: Map<string, string>;
  legend: { title: string; entries: { key: string; label: string; color: string }[]; note: string };
}

export function scenarioPaint(result: ScenarioResult, tokens: ThemeTokens, label: string): GraphPaint {
  const nodes: GraphPaint['nodes'] = new Map();
  const edges: GraphPaint['edges'] = new Map();
  for (const i of result.impacts.values()) {
    nodes.set(i.id, { color: lensColor('risk', i.hop === 0 ? 0.99 : Math.min(0.95, i.impact / 0.8), tokens), strong: i.hop === 0 || i.impact >= 0.3 });
    for (const step of i.path) edges.set(step.relId, lensColor('risk', Math.min(0.95, i.impact / 0.8), tokens));
  }
  for (const b of result.beneficiaries) if (!nodes.has(b.id)) nodes.set(b.id, { color: lensColor('opportunity', 0.7, tokens) });
  return {
    nodes,
    edges,
    legend: {
      title: label,
      entries: [
        { key: 'shocked', label: 'Shocked directly', color: lensColor('risk', 0.99, tokens) },
        { key: 'high', label: 'Heavily affected', color: lensColor('risk', 0.7, tokens) },
        { key: 'low', label: 'Lightly affected', color: lensColor('risk', 0.1, tokens) },
        { key: 'gain', label: 'Competitor that may gain', color: lensColor('opportunity', 0.7, tokens) },
      ],
      note: 'Tinted links carry the shock. Unaffected companies are dimmed.',
    },
  };
}

export function portfolioPaint(a: PortfolioAnalysis, tokens: ThemeTokens): GraphPaint {
  const nodes: GraphPaint['nodes'] = new Map();
  const edges: GraphPaint['edges'] = new Map();
  const maxW = Math.max(1e-9, ...a.companies.map((r) => r.weight));
  a.companies.forEach((r, i) => nodes.set(r.id, { color: lensColor('opportunity', 0.35 + 0.64 * (r.weight / maxW), tokens), strong: i < 25 }));
  const deps = a.dependencies.filter((d) => !d.alsoHeld && d.reach > 0).slice(0, 20);
  const maxD = Math.max(1e-9, ...deps.map((d) => d.exposure));
  for (const d of deps) {
    const c = lensColor('risk', 0.35 + 0.64 * (d.exposure / maxD), tokens);
    nodes.set(d.id, { color: c, strong: d.reach > 0.1 });
    for (const h of d.holdings) if (h.materiality >= 0.6) edges.set(h.relId, c);
  }
  return {
    nodes,
    edges,
    legend: {
      title: 'Your portfolio',
      entries: [
        { key: 'held', label: 'Held (darker = larger share)', color: lensColor('opportunity', 0.9, tokens) },
        { key: 'dep', label: 'Depended on, not held', color: lensColor('risk', 0.9, tokens) },
      ],
      note: 'Tinted links are material supplier and customer ties from your holdings.',
    },
  };
}
