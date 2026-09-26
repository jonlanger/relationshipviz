import type { Sector } from '@/data/schema';

/** Short sector names for tight chart labels. Full names appear in tooltips and tables. */
export const SECTOR_SHORT: Record<Sector, string> = {
  'Information Technology': 'Info Tech',
  'Communication Services': 'Comm Services',
  'Consumer Discretionary': 'Cons Discretionary',
  'Health Care': 'Health Care',
  Financials: 'Financials',
  Industrials: 'Industrials',
  'Consumer Staples': 'Cons Staples',
  Energy: 'Energy',
  Materials: 'Materials',
  Utilities: 'Utilities',
  'Real Estate': 'Real Estate',
};
