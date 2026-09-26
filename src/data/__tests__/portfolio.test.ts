import { describe, expect, it } from 'vitest';
import { analyzePortfolio, LIMITS } from '../portfolio';
import { buildMatcher, mapHoldings, parseHoldingRow, tsvColumns, HOLDING_COLUMNS, type Fund } from '../funds';
import { normalizeName, shortNameOf } from '@/lib/names';
import { co, rel } from './fixtures';

const tw = { city: 'Hsinchu', country: 'Taiwan', countryCode: 'TW', lat: 0, lng: 0 };
const companies = [
  co('FAB', { name: 'Fab Semiconductor Manufacturing Co., Ltd.', shortName: 'Fab', hq: tw }),
  co('GPU', { name: 'GPU Corporation', shortName: 'GPU' }),
  co('PHONE', { name: 'Phone Inc.', shortName: 'Phone', sector: 'Consumer Discretionary' }),
  co('BANK', { name: 'Bank Holdings, Inc.', shortName: 'Bank', sector: 'Financials' }),
];
const rels = [rel('FAB', 'GPU', { weight: 0.95 }), rel('FAB', 'PHONE', { weight: 0.9 }), rel('GPU', 'PHONE', { weight: 0.3 })];

const fund = (ticker: string, holdings: [string, number][], unmappedWeight = 0): Fund => ({
  ticker, name: ticker, kind: 'etf', seriesId: null, asOf: '2025-06-30', filingUrl: null, netAssetsUsdB: 1,
  holdings: holdings.map(([id, weight]) => ({ id, weight })), unmappedWeight, topUnmapped: [], unavailable: null, alternative: null,
});
const funds = new Map([
  ['SEMI', fund('SEMI', [['GPU', 0.5], ['FAB', 0.3]], 0.2)],
  ['TECH', fund('TECH', [['GPU', 0.4], ['FAB', 0.2], ['PHONE', 0.4]])],
]);

describe('names', () => {
  it('shortens index names', () => {
    expect(shortNameOf('Coca-Cola Company (The)')).toBe('Coca-Cola');
    expect(shortNameOf('Block, Inc.')).toBe('Block');
    expect(shortNameOf('American Airlines Group')).toBe('American Airlines');
    expect(shortNameOf('Hartford (The)')).toBe('Hartford');
    expect(shortNameOf('3M')).toBe('3M');
  });
  it('normalizes issuer names for matching', () => {
    expect(normalizeName('NVIDIA CORP')).toBe(normalizeName('NVIDIA Corporation'));
    expect(normalizeName('Alphabet Inc Class A')).toBe('alphabet');
  });
});

describe('N-PORT parsing and mapping', () => {
  const header = 'ACCESSION_NUMBER\tHOLDING_ID\tISSUER_NAME\tISSUER_LEI\tISSUER_TITLE\tISSUER_CUSIP\tBALANCE\tPERCENTAGE';
  const col = tsvColumns(header, HOLDING_COLUMNS);
  const acc = new Set(['0001-25-1']);

  it('keeps rows for wanted filings and converts percent to a fraction', () => {
    const h = parseHoldingRow('0001-25-1\t9\tGPU CORP\tLEI\tGPU CORP\t123456789\t100\t7.5', col, acc)!;
    expect(h).toMatchObject({ holdingId: '9', name: 'GPU CORP', cusip: '123456789', pct: 0.075 });
    expect(parseHoldingRow('9999-25-1\t9\tX\tL\tX\t123456789\t1\t1', col, acc)).toBeNull();
  });

  it('fails loudly when a required column is missing', () => {
    expect(() => tsvColumns('ACCESSION_NUMBER\tFOO', HOLDING_COLUMNS)).toThrow(/HOLDING_ID/);
  });

  it('maps by ticker, then name, and learns CUSIPs', () => {
    const m = buildMatcher(companies);
    const out = mapHoldings(
      [
        { accession: 'a', holdingId: '1', name: 'Something Else', title: '', cusip: 'AAAAAAAA1', pct: 0.1, ticker: 'GPU' },
        { accession: 'a', holdingId: '2', name: 'PHONE INC', title: '', cusip: 'BBBBBBBB2', pct: 0.2 },
        { accession: 'a', holdingId: '3', name: 'Not In Universe Corp', title: '', cusip: null, pct: 0.05 },
      ],
      m,
    );
    expect(out.holdings).toEqual([{ id: 'PHONE', weight: 0.2 }, { id: 'GPU', weight: 0.1 }]);
    expect(out.unmappedWeight).toBeCloseTo(0.05);
    expect(out.learned).toEqual({ AAAAAAAA1: 'GPU', BBBBBBBB2: 'PHONE' });
  });
});

describe('analyzePortfolio', () => {
  it('looks through funds into company exposure', () => {
    const a = analyzePortfolio([{ kind: 'fund', id: 'SEMI', amount: 50 }, { kind: 'stock', id: 'GPU', amount: 50 }], companies, rels, funds);
    const gpu = a.companies.find((r) => r.id === 'GPU')!;
    expect(gpu.weight).toBeCloseTo(0.5 + 0.5 * 0.5);
    expect(gpu.via).toEqual([{ source: 'SEMI', weight: 0.25 }, { source: 'direct', weight: 0.5 }]);
    expect(a.mapped).toBeCloseTo(0.5 + 0.5 * 0.8);
  });

  it('surfaces a hidden dependency and its jurisdiction', () => {
    const a = analyzePortfolio([{ kind: 'stock', id: 'GPU', amount: 1 }, { kind: 'stock', id: 'PHONE', amount: 1 }], companies, rels, funds);
    const fab = a.dependencies[0];
    expect(fab.id).toBe('FAB');
    expect(fab.alsoHeld).toBe(false);
    expect(fab.reach).toBeCloseTo(1);
    expect(fab.exposure).toBeCloseTo(0.5 * 0.95 + 0.5 * 0.9);
    expect(a.jurisdictions.find((j) => j.code === 'TW')!.weight).toBeCloseTo(1);
    expect(a.warnings.map((w) => w.kind)).toEqual(expect.arrayContaining(['dependency', 'jurisdiction']));
  });

  it('measures fund overlap as shared minimum weight', () => {
    const a = analyzePortfolio([{ kind: 'fund', id: 'SEMI', amount: 1 }, { kind: 'fund', id: 'TECH', amount: 1 }], companies, rels, funds);
    expect(a.overlaps[0].shared).toBeCloseTo(0.4 + 0.2);
    expect(a.warnings.some((w) => w.kind === 'overlap')).toBe(0.6 > LIMITS.overlap);
  });

  it('warns on concentration and stays quiet for a spread portfolio', () => {
    const one = analyzePortfolio([{ kind: 'stock', id: 'BANK', amount: 1 }], companies, rels, funds);
    expect(one.warnings.find((w) => w.kind === 'company')?.severity).toBe('high');
    const none = analyzePortfolio([], companies, rels, funds);
    expect(none.total).toBe(0);
    expect(none.warnings).toEqual([]);
  });
});
