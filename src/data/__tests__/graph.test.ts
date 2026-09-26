import { buildGraph, nodeSize, pairKey } from '../graph';
import { co, dataset, rel } from './fixtures';

describe('buildGraph', () => {
  const d = dataset(
    [co('A', { marketCap: 400 }), co('B', { marketCap: 100 }), co('C')],
    [
      rel('A', 'B', { weight: 0.3 }),
      rel('A', 'B', { type: 'competitor', weight: 0.8, id: 'x' }),
      rel('B', 'C', { type: 'partner' }),
    ],
  );
  const g = buildGraph(d);

  it('creates one node per company and one edge per pair', () => {
    expect(g.order).toBe(3);
    expect(g.size).toBe(2);
  });

  it('aggregates multiple relationships between a pair, strongest first', () => {
    const e = g.getEdgeAttributes(pairKey('A', 'B'));
    expect(e.relationships).toHaveLength(2);
    expect(e.primaryType).toBe('competitor');
    expect(e.types).toEqual(['competitor', 'supplier']);
    expect(e.directed).toBe(false);
  });

  it('sizes nodes by sqrt of market cap', () => {
    expect(g.getNodeAttribute('A', 'size')).toBeCloseTo(nodeSize(400, 400));
    expect(nodeSize(100, 400)).toBeLessThan(nodeSize(400, 400));
    expect(nodeSize(0, 400)).toBe(3);
  });
});
