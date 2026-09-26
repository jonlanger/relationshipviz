import { describe, expect, it } from 'vitest';
import type { Company, FiscalYear } from '../schema';
import { computeMetrics } from '../metrics';
import { computeLenses } from '../lenses';
import { DEFAULT_ANSWERS, dividendProfile, findIdeas, type IdeaAnswers } from '../ideas';
import { analyzePortfolio } from '../portfolio';
import { co, rel } from './fixtures';

const fin = (revenues: number[], margin: number, dps: number[] = []): Company['financials'] => ({
  currency: 'USD',
  source: 'sec-xbrl',
  sourceUrl: 'https://example.com',
  annual: revenues.map<FiscalYear>((revenue, i) => ({
    fiscalYear: 2021 + i,
    end: `${2021 + i}-12-31`,
    revenue,
    netIncome: revenue * margin,
    rnd: null,
    epsDiluted: 5,
    dividendsPerShare: dps.length ? dps[i] : null,
  })),
});
const tw = { city: 'Hsinchu', country: 'Taiwan', countryCode: 'TW', lat: 0, lng: 0 };

const companies = [
  co('FAB', { industry: 'Semiconductors', hq: tw, financials: fin([100, 130, 170, 220], 0.4) }),
  co('GPU', { industry: 'Semiconductors', financials: fin([100, 200, 400, 800], 0.5) }),
  co('SOFT', { industry: 'Application Software', financials: fin([100, 115, 130, 150], 0.25) }),
  co('UTIL', { industry: 'Electric Utilities', sector: 'Utilities', financials: fin([100, 102, 104, 106], 0.12, [2, 2.1, 2.2, 2.3]) }),
  co('SODA', { industry: 'Soft Drinks & Non-alcoholic Beverages', sector: 'Consumer Staples', financials: fin([100, 103, 106, 109], 0.2, [1.5, 1.6, 1.7, 1.8]) }),
  co('BANK', { industry: 'Diversified Banks', sector: 'Financials', financials: fin([100, 90, 85, 80], 0.05, [1, 1, 0.5, 0.5]) }),
];
const rels = [rel('FAB', 'GPU', { weight: 0.95 }), rel('GPU', 'SOFT', { weight: 0.5 }), rel('SODA', 'BANK', { type: 'partner', weight: 0.3 })];
const lenses = computeLenses(companies, rels, computeMetrics(companies, rels), undefined, { asOf: '2025-06' });
const ideas = (a: Partial<IdeaAnswers>) => findIdeas({ ...DEFAULT_ANSWERS, ...a }, companies, rels, lenses);

describe('dividendProfile', () => {
  it('counts consecutive raises and payout', () => {
    expect(dividendProfile(companies[3])).toEqual({ pays: true, raises: 3, payout: 2.3 / 5 });
    expect(dividendProfile(companies[5])!.raises).toBe(0);
    expect(dividendProfile(companies[0])).toEqual({ pays: false, raises: 0, payout: null });
  });
});

describe('findIdeas', () => {
  it('ranks growers first for a growth goal and dividend payers first for income', () => {
    expect(ideas({ goal: 'growth', swings: 'high' }).companies[0].id).toBe('GPU');
    const income = ideas({ goal: 'income', swings: 'low' }).companies.map((c) => c.id);
    expect(income.slice(0, 2).sort()).toEqual(['SODA', 'UTIL']);
  });

  it('keeps only theme members, including supply-chain neighbours at half strength', () => {
    const r = ideas({ themes: ['ai'] });
    expect(r.companies.map((c) => c.id).sort()).toEqual(['FAB', 'GPU']);
    expect(r.companies.find((c) => c.id === 'GPU')!.reasons.join(' ')).toMatch(/Core AI/);
  });

  it('treats exclusions as hard filters, including high-risk jurisdiction dependence', () => {
    const r = ideas({ avoidSectors: ['Utilities'], avoidHighRiskJurisdictions: true });
    const ids = r.companies.map((c) => c.id);
    expect(ids).not.toContain('UTIL');
    expect(ids).not.toContain('FAB');
    expect(ids).not.toContain('GPU');
    expect(r.excluded.find((e) => e.id === 'GPU')!.why).toMatch(/depends on FAB/);
  });

  it('marks down what the portfolio already holds', () => {
    const base = ideas({ goal: 'growth' }).companies.find((c) => c.id === 'GPU')!;
    const pf = analyzePortfolio([{ kind: 'stock', id: 'GPU', amount: 1 }], companies, rels, new Map());
    const withHolding = findIdeas({ ...DEFAULT_ANSWERS, goal: 'growth' }, companies, rels, lenses, [], pf).companies.find((c) => c.id === 'GPU')!;
    expect(withHolding.fit).toBeLessThan(base.fit);
    expect(withHolding.watchouts.join(' ')).toMatch(/Already 100% of your portfolio/);
  });

  it('never returns position sizes, only fit, reasons and watch-outs', () => {
    const r = ideas({});
    for (const c of r.companies) expect(Object.keys(c).sort()).toEqual(['fit', 'id', 'reasons', 'signals', 'watchouts']);
  });

  it('reports funds without holdings as unavailable instead of scoring them', () => {
    const r = findIdeas(DEFAULT_ANSWERS, companies, rels, lenses, [
      { ticker: 'X', name: 'X', kind: 'etf', seriesId: null, asOf: null, filingUrl: null, netAssetsUsdB: null, holdings: [], unmappedWeight: 0, topUnmapped: [], unavailable: 'not loaded', alternative: null },
    ]);
    expect(r.funds).toEqual([]);
    expect(r.fundsUnavailable).toBe(1);
  });
});
