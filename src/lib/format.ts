/** Formatting helpers. All numeric output uses en-US grouping for consistency. */

/** Market cap given in USD billions → "$3.5T", "$450B", "$28B". */
export function formatMarketCap(billions: number): string {
  if (billions >= 1000) return `$${(billions / 1000).toFixed(billions >= 10_000 ? 0 : 1).replace(/\.0$/, '')}T`;
  if (billions >= 10) return `$${Math.round(billions)}B`;
  return `$${billions.toFixed(1).replace(/\.0$/, '')}B`;
}

const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
export const formatCompact = (n: number) => compact.format(n);

const grouped = new Intl.NumberFormat('en-US');
export const formatNumber = (n: number) => grouped.format(n);

export const formatPercent = (fraction: number, digits = 0) => `${(fraction * 100).toFixed(digits)}%`;

export const formatDecimal = (n: number, digits = 2) => n.toFixed(digits);

export function pluralize(n: number, one: string, many = `${one}s`) {
  return `${formatNumber(n)} ${n === 1 ? one : many}`;
}

const CURRENCY_PREFIX: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  TWD: 'NT$',
  KRW: '₩',
  DKK: 'DKK ',
  CHF: 'CHF ',
};

/** Raw currency amount → "$130.5B", "NT$2.9T", "€32.7B", "-$22.8B". */
export function formatMoney(amount: number, currency = 'USD'): string {
  const prefix = CURRENCY_PREFIX[currency] ?? `${currency} `;
  const abs = Math.abs(amount);
  const [v, unit] =
    abs >= 1e12 ? [abs / 1e12, 'T'] : abs >= 1e9 ? [abs / 1e9, 'B'] : abs >= 1e6 ? [abs / 1e6, 'M'] : [abs, ''];
  const digits = v >= 1000 ? 0 : 1;
  return `${amount < 0 ? '-' : ''}${prefix}${v.toFixed(digits).replace(/\.0$/, '')}${unit}`;
}

/** USD billions (deal values) → "$250B", "$1.6B", "$1.2T". */
export const formatUsdBillions = (b: number) => formatMoney(b * 1e9, 'USD');

/** "2025-10-28" → "Oct 28, 2025"; "2025-10" → "Oct 2025"; "2025" / "2025-Q2" pass through. */
export function formatPartialDate(d: string): string {
  const m = d.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
  if (!m) return d.replace('-Q', ' Q');
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3] ?? 1)));
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric', ...(m[3] ? { day: 'numeric' } : {}), timeZone: 'UTC' });
}

/** A company's market cap for display: "—" when unknown (some generated S&P 500 records). */
export function formatCompanyCap(c: { marketCap: number; marketCapSource?: string }): string {
  return c.marketCapSource === 'unknown' ? '—' : formatMarketCap(c.marketCap);
}

/** Caption for where a market cap comes from. */
export function capCaption(c: { marketCapSource?: string; marketCapAsOf?: string | null }, datasetAsOf: string): string {
  if (c.marketCapSource === 'unknown') return 'Not available';
  if (c.marketCapSource === 'wikidata') return `Wikidata${c.marketCapAsOf ? `, ${c.marketCapAsOf.slice(0, 7)}` : ''}`;
  return `Approx., ${datasetAsOf}`;
}
