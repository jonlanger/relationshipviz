/**
 * Jurisdiction risk tiers used by the Risk lens's geographic-exposure factor.
 *
 * These are editorial assumptions, not data: a coarse read of geopolitical, sanctions and
 * export-control exposure for an equity holder. They're listed on the Data page. Edit here to
 * change them; anything not listed is treated as low risk.
 */
export type CountryRiskTier = 'high' | 'elevated' | 'low';

export interface CountryRisk {
  /** 0–1. */
  score: number;
  tier: CountryRiskTier;
  note: string;
}

export const COUNTRY_RISK: Record<string, CountryRisk> = {
  RU: { score: 1, tier: 'high', note: 'Sanctions; assets and trade can be frozen' },
  TW: { score: 0.9, tier: 'high', note: 'Cross-strait tension; most leading-edge chip capacity sits here' },
  CN: { score: 0.8, tier: 'high', note: 'Export controls, sanctions and regulatory intervention' },
  HK: { score: 0.6, tier: 'elevated', note: 'Tied to mainland policy and sanctions exposure' },
  IL: { score: 0.5, tier: 'elevated', note: 'Regional conflict' },
  KR: { score: 0.5, tier: 'elevated', note: 'Peninsula tension; export-control exposure via China fabs' },
};

export const LOW_COUNTRY_RISK: CountryRisk = { score: 0.1, tier: 'low', note: 'Stable jurisdiction' };

export function countryRisk(countryCode: string): CountryRisk {
  return COUNTRY_RISK[countryCode] ?? LOW_COUNTRY_RISK;
}
