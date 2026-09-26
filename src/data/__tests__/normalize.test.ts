import { mergeRelationships, normalizeRelationship } from '../normalize';
import { rel } from './fixtures';

describe('normalizeRelationship', () => {
  it('turns customer into a reversed supplier', () => {
    const r = normalizeRelationship({ ...rel('AAPL', 'TSM'), type: 'customer' });
    expect(r).toMatchObject({ source: 'TSM', target: 'AAPL', type: 'supplier', id: 'tsm__supplier__aapl' });
  });

  it('orders symmetric types so A↔B and B↔A share an id', () => {
    const a = normalizeRelationship(rel('V', 'MA', { type: 'competitor' }));
    const b = normalizeRelationship(rel('MA', 'V', { type: 'competitor' }));
    expect(a.id).toBe(b.id);
  });
});

describe('mergeRelationships', () => {
  it('keeps the first list on conflict and accumulates evidence', () => {
    const curated = [rel('TSM', 'AAPL', { weight: 0.9 })];
    const scraped = [
      { ...rel('AAPL', 'TSM', { weight: 0.3, confidence: 0.4 }), type: 'customer' as const,
        evidence: [{ kind: 'filing' as const, url: 'https://sec.gov/x', note: 'excerpt' }] },
    ];
    const [m] = mergeRelationships(curated, scraped);
    expect(m.weight).toBe(0.9);
    expect(m.confidence).toBe(0.9);
    expect(m.evidence.map((e) => e.kind)).toEqual(['curated', 'filing']);
  });
});
