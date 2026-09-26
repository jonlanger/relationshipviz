import { groupRelations, viewRelation } from '../relations';
import { rel } from '@/data/__tests__/fixtures';

describe('relations', () => {
  it('splits supply ties into suppliers and customers', () => {
    expect(viewRelation(rel('TSM', 'NVDA'), 'NVDA')).toMatchObject({ group: 'suppliers', verb: 'Supplied by', direction: 'in' });
    expect(viewRelation(rel('NVDA', 'MSFT'), 'NVDA')).toMatchObject({ group: 'customers', verb: 'Supplies', direction: 'out' });
  });
  it('handles investors and symmetric types', () => {
    expect(viewRelation(rel('BRK', 'AAPL', { type: 'investor' }), 'AAPL').group).toBe('backers');
    expect(viewRelation(rel('AMD', 'NVDA', { type: 'competitor' }), 'NVDA')).toMatchObject({ group: 'competitors', direction: 'both' });
  });
  it('groups in a stable order, strongest first', () => {
    const g = groupRelations(
      [rel('NVDA', 'MSFT', { weight: 0.5 }), rel('TSM', 'NVDA'), rel('NVDA', 'META', { weight: 0.9 })],
      'NVDA',
    );
    expect(g.map((x) => x.group)).toEqual(['suppliers', 'customers']);
    expect(g[1].items.map((i) => i.view.otherId)).toEqual(['META', 'MSFT']);
  });
});
