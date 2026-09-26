/**
 * Investment themes for the idea finder. A company belongs to a theme directly (its industry or
 * a named anchor company) or through the supply chain: a material supplier or customer of a core
 * member counts as an adjacent member at half strength.
 */
import type { Company, Relationship, Sector } from './schema';
import { effectiveMateriality } from './lenses';

export interface Theme {
  id: string;
  label: string;
  description: string;
  industries?: RegExp;
  sectors?: Sector[];
  anchors?: string[];
}

export const THEMES: Theme[] = [
  {
    id: 'ai',
    label: 'AI & semiconductors',
    description: 'Chips, chip equipment, AI labs and the clouds that run them, plus their supply chains.',
    industries: /Semiconductor|AI Research/,
    anchors: ['NVDA', 'AMD', 'AVGO', 'TSM', 'MSFT', 'GOOGL', 'META', 'AMZN', 'ORCL', 'ANET', 'SMCI', 'MU', 'ASML', 'ARM', 'openai', 'anthropic', 'DELL', 'VRT', 'PLTR'],
  },
  {
    id: 'cloud',
    label: 'Cloud & software',
    description: 'Software, internet platforms, data and IT services.',
    industries: /Software|Internet Services|Interactive Media|IT Consulting|Data Processing|Financial Data|Financial Exchanges/,
  },
  {
    id: 'health',
    label: 'Healthcare innovation',
    description: 'Drug makers, biotech, medical devices and life-science tools.',
    industries: /Pharmaceutical|Biotech|Health Care Equipment|Health Care Supplies|Life Sciences|Health Care Technology/,
  },
  {
    id: 'energy',
    label: 'Energy & power',
    description: 'Oil and gas, utilities, power producers and grid equipment, including AI-era electricity demand.',
    industries: /Oil|Gas|Utilities|Independent Power|Renewable|Heavy Electrical|Electrical Components/,
  },
  {
    id: 'consumer',
    label: 'Consumer brands',
    description: 'Everyday brands, retailers and restaurants.',
    sectors: ['Consumer Staples'],
    industries: /Restaurants|Apparel|Footwear|Household|Beverages|Soft Drinks|Packaged Foods|Hotels|Home Improvement|Broadline Retail|Personal Care|Leisure/,
  },
  {
    id: 'financials',
    label: 'Banks & financials',
    description: 'Banks, payments, insurers, asset managers and exchanges.',
    sectors: ['Financials'],
  },
  {
    id: 'industrials',
    label: 'Industrials & defense',
    description: 'Aerospace and defense, machinery, construction, rail and logistics.',
    industries: /Aerospace|Defense|Machinery|Construction|Rail|Freight|Logistics|Building Products|Industrial Conglomerates|Trading Companies/,
  },
  {
    id: 'realestate',
    label: 'Real estate & infrastructure',
    description: 'REITs, including data centers, towers and warehouses.',
    sectors: ['Real Estate'],
  },
];

export const THEME_BY_ID = new Map(THEMES.map((t) => [t.id, t]));

/** Membership per theme: 1 = core member, 0.5 = material supplier or customer of a core member. */
export function themeMembership(companies: Company[], relationships: Relationship[]): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>();
  const known = new Set(companies.map((c) => c.id));
  for (const t of THEMES) {
    const m = new Map<string, number>();
    for (const c of companies) {
      if (t.anchors?.includes(c.id) || t.sectors?.includes(c.sector) || t.industries?.test(c.industry)) m.set(c.id, 1);
    }
    for (const r of relationships) {
      if (r.type !== 'supplier' || !known.has(r.source) || !known.has(r.target)) continue;
      // A supplier that a core member depends on, or a customer that is a big share of a core member's business.
      if (m.get(r.target) === 1 && !m.has(r.source) && effectiveMateriality(r, r.target) >= 0.6) m.set(r.source, 0.5);
      if (m.get(r.source) === 1 && !m.has(r.target) && effectiveMateriality(r, r.source) >= 0.6) m.set(r.target, 0.5);
    }
    out.set(t.id, m);
  }
  return out;
}
