import { describe, expect, it } from 'vitest';
import { DAMPING, exposureImpact, runScenario, shockedIds } from '../scenarios';
import { co, rel } from './fixtures';

const tw = { city: 'Hsinchu', country: 'Taiwan', countryCode: 'TW', lat: 0, lng: 0 };
const companies = [co('FAB', { hq: tw }), co('CHIP'), co('CLOUD'), co('APP'), co('RIVAL'), co('TOOL'), co('FAR')];
const rels = [
  rel('TOOL', 'FAB', { weight: 0.6 }), // TOOL supplies FAB
  rel('FAB', 'CHIP', { weight: 0.9 }), // FAB supplies CHIP
  rel('CHIP', 'CLOUD', { weight: 0.8 }), // CHIP supplies CLOUD
  rel('CLOUD', 'APP', { weight: 0.5 }), // CLOUD supplies APP
  rel('APP', 'FAR', { weight: 0.9 }), // 4 hops from FAB
  rel('CHIP', 'RIVAL', { type: 'competitor', weight: 0.8 }),
];

describe('runScenario', () => {
  it('selects shocked companies by country, sector or id', () => {
    expect(shockedIds({ kind: 'country', code: 'TW' }, companies)).toEqual(['FAB']);
    expect(shockedIds({ kind: 'company', ids: ['CHIP', 'NOPE'] }, companies)).toEqual(['CHIP']);
    expect(shockedIds({ kind: 'sector', sector: 'Information Technology' }, companies)).toHaveLength(companies.length);
  });

  it('passes a disruption downstream by dependence, damped after the first hop, within MAX_HOPS', () => {
    const r = runScenario({ target: { kind: 'country', code: 'TW' }, mode: 'disruption', severity: 0.8 }, companies, rels);
    expect(r.impacts.get('FAB')).toMatchObject({ impact: 0.8, hop: 0 });
    const chip = r.impacts.get('CHIP')!;
    expect(chip.impact).toBeCloseTo(0.8 * 0.9);
    expect(chip.path).toEqual([{ from: 'FAB', to: 'CHIP', relId: rels[1].id, role: 'supplier' }]);
    expect(r.impacts.get('CLOUD')!.impact).toBeCloseTo(0.8 * 0.9 * 0.8 * DAMPING);
    expect(r.impacts.get('CLOUD')!.path.map((p) => p.to)).toEqual(['CHIP', 'CLOUD']);
    // FAB's supplier loses a customer.
    expect(r.impacts.get('TOOL')!.impact).toBeCloseTo(0.8 * 0.6);
    expect(r.impacts.has('FAR')).toBe(false);
  });

  it('sends a demand shock upstream only', () => {
    const r = runScenario({ target: { kind: 'company', ids: ['CLOUD'] }, mode: 'demand', severity: 0.5 }, companies, rels);
    expect(r.impacts.get('CHIP')!.impact).toBeCloseTo(0.5 * 0.8);
    expect(r.impacts.has('APP')).toBe(false);
  });

  it('lists competitors of shocked companies as possible beneficiaries', () => {
    const r = runScenario({ target: { kind: 'company', ids: ['CHIP'] }, mode: 'disruption', severity: 1 }, companies, rels);
    expect(r.beneficiaries[0]).toMatchObject({ id: 'RIVAL', via: 'CHIP' });
  });

  it('weights portfolio impact by exposure', () => {
    const r = runScenario({ target: { kind: 'country', code: 'TW' }, mode: 'disruption', severity: 1 }, companies, rels);
    const exposure = new Map([['CHIP', 0.5], ['RIVAL', 0.5]]);
    expect(exposureImpact(r, exposure)).toBeCloseTo(0.5 * 0.9);
  });
});
