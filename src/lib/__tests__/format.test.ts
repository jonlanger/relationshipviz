import { formatMarketCap, formatMoney, formatPartialDate, formatPercent, formatUsdBillions, pluralize } from '../format';

describe('format', () => {
  it('formats market caps', () => {
    expect(formatMarketCap(3500)).toBe('$3.5T');
    expect(formatMarketCap(1000)).toBe('$1T');
    expect(formatMarketCap(450)).toBe('$450B');
    expect(formatMarketCap(5.25)).toBe('$5.3B');
  });
  it('formats percents and plurals', () => {
    expect(formatPercent(0.456)).toBe('46%');
    expect(pluralize(1, 'company', 'companies')).toBe('1 company');
    expect(pluralize(1200, 'link')).toBe('1,200 links');
  });
});

describe('money & dates', () => {
  it('formats currency amounts', () => {
    expect(formatMoney(130.5e9)).toBe('$130.5B');
    expect(formatMoney(2_894.3e9, 'TWD')).toBe('NT$2.9T');
    expect(formatMoney(-22.8e9)).toBe('-$22.8B');
    expect(formatMoney(32.7e9, 'EUR')).toBe('€32.7B');
    expect(formatUsdBillions(250)).toBe('$250B');
  });
  it('formats partial dates', () => {
    expect(formatPartialDate('2025-10-28')).toBe('Oct 28, 2025');
    expect(formatPartialDate('2025-10')).toBe('Oct 2025');
    expect(formatPartialDate('2025')).toBe('2025');
    expect(formatPartialDate('2025-Q2')).toBe('2025 Q2');
  });
});
