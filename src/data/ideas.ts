/**
 * Idea finder: turns a short questionnaire into a ranked list of companies and funds *to research*.
 *
 * Every company gets a handful of 0–1 signals (growth, opportunity, steadiness, income, quality,
 * theme fit). The investor's goal picks how those are weighted; their comfort with swings sets how
 * much above-median risk is penalized; exclusions are hard filters; current holdings steer away from
 * doubling up. Each result carries the reasons behind its score and the watch-outs from the Risk lens.
 *
 * This is an educational screen, not personalized advice: it never sizes positions or says buy/sell.
 */
import type { Company, Relationship, Sector } from './schema';
import type { Fund } from './funds';
import { countryRisk } from './countryRisk';
import { effectiveMateriality, netMargin, percentiles, revenueCagr, type CompanyLens, type LensResult } from './lenses';
import { THEME_BY_ID, themeMembership } from './themes';
import type { PortfolioAnalysis } from './portfolio';

export type Goal = 'growth' | 'income' | 'balanced' | 'steady';
export type Horizon = 'short' | 'medium' | 'long';
export type Swings = 'low' | 'medium' | 'high';
export type Prefer = 'stocks' | 'funds' | 'both';

export interface IdeaAnswers {
  goal: Goal;
  horizon: Horizon;
  swings: Swings;
  themes: string[];
  avoidSectors: Sector[];
  /** Exclude companies headquartered in, or materially dependent on, higher-risk jurisdictions. */
  avoidHighRiskJurisdictions: boolean;
  prefer: Prefer;
}

export const DEFAULT_ANSWERS: IdeaAnswers = {
  goal: 'balanced',
  horizon: 'medium',
  swings: 'medium',
  themes: [],
  avoidSectors: [],
  avoidHighRiskJurisdictions: false,
  prefer: 'both',
};

type Signal = 'growth' | 'opportunity' | 'steadiness' | 'income' | 'quality' | 'theme';

/** How each goal weighs the signals. Shown on the Data page. */
export const GOAL_WEIGHTS: Record<Goal, Record<Signal, number>> = {
  growth: { growth: 0.3, opportunity: 0.3, theme: 0.25, quality: 0.1, steadiness: 0.05, income: 0 },
  income: { income: 0.4, steadiness: 0.25, quality: 0.15, opportunity: 0.1, theme: 0.1, growth: 0 },
  balanced: { opportunity: 0.2, growth: 0.15, steadiness: 0.2, quality: 0.15, income: 0.1, theme: 0.2 },
  steady: { steadiness: 0.4, quality: 0.2, income: 0.15, opportunity: 0.1, theme: 0.15, growth: 0 },
};

/** Highest Risk-lens percentile accepted without penalty. Shorter horizons tolerate less. */
export const RISK_TOLERANCE: Record<Swings, number> = { low: 0.4, medium: 0.65, high: 0.9 };
const HORIZON_ADJUST: Record<Horizon, number> = { short: -0.1, medium: 0, long: 0.05 };
/** Fit points lost per percentile point of risk above tolerance. */
const RISK_PENALTY = 1.5;

export const SIGNAL_LABEL: Record<Signal, string> = {
  growth: 'Growth',
  opportunity: 'Opportunity lens',
  steadiness: 'Steadiness',
  income: 'Income',
  quality: 'Profitability',
  theme: 'Theme fit',
};

export interface CompanyIdea {
  id: string;
  /** 0–100. */
  fit: number;
  reasons: string[];
  watchouts: string[];
  signals: Record<Signal, number | null>;
}

export interface FundIdea {
  ticker: string;
  fit: number;
  reasons: string[];
  watchouts: string[];
}

export interface IdeaResult {
  companies: CompanyIdea[];
  funds: FundIdea[];
  excluded: { id: string; why: string }[];
  /** Funds we couldn't score because their holdings aren't loaded. */
  fundsUnavailable: number;
}

// ---------- Company signals from filings ----------

/** Dividend facts from annual filings: whether it pays, and how many years it has raised in a row. */
export function dividendProfile(c: Company): { pays: boolean; raises: number; payout: number | null } | null {
  const years = (c.financials?.annual ?? []).filter((y) => y.dividendsPerShare !== undefined);
  if (!years.length) return null;
  const dps = years.map((y) => y.dividendsPerShare ?? 0);
  const last = years[years.length - 1];
  let raises = 0;
  for (let i = dps.length - 1; i > 0 && dps[i] > dps[i - 1] && dps[i - 1] > 0; i--) raises++;
  const eps = last.epsDiluted;
  return {
    pays: (last.dividendsPerShare ?? 0) > 0,
    raises,
    payout: eps && eps > 0 && last.dividendsPerShare ? last.dividendsPerShare / eps : null,
  };
}

/** 0–1: steadier revenue growth and consistent profits score higher. */
function steadinessRaw(c: Company): number | null {
  const ys = (c.financials?.annual ?? []).filter((y) => y.revenue != null && y.revenue > 0);
  if (ys.length < 3) return null;
  const growth = ys.slice(1).map((y, i) => y.revenue! / ys[i].revenue! - 1);
  const mean = growth.reduce((a, b) => a + b, 0) / growth.length;
  const sd = Math.sqrt(growth.reduce((a, g) => a + (g - mean) ** 2, 0) / growth.length);
  const profitable = ys.filter((y) => (y.netIncome ?? 0) > 0).length / ys.length;
  return 0.5 * profitable + 0.5 * (1 - Math.min(1, sd / 0.3));
}

function incomeRaw(c: Company): number | null {
  const d = dividendProfile(c);
  if (!d) return null;
  if (!d.pays) return 0;
  const sustainable = d.payout == null ? 0.5 : d.payout <= 0.75 ? 1 : d.payout <= 1 ? 0.5 : 0;
  return 0.4 + 0.4 * Math.min(1, d.raises / 5) + 0.2 * sustainable;
}

const pct = (v: number) => `${Math.round(v * 100)}%`;
const signed = (v: number) => `${v >= 0 ? '+' : ''}${Math.round(v * 100)}%`;

// ---------- Engine ----------

export function findIdeas(
  answers: IdeaAnswers,
  companies: Company[],
  relationships: Relationship[],
  lenses: LensResult,
  funds: Fund[] = [],
  portfolio: PortfolioAnalysis | null = null,
  limits = { companies: 10, funds: 5 },
): IdeaResult {
  const byId = new Map(companies.map((c) => [c.id, c]));
  const members = themeMembership(companies, relationships);
  const chosenThemes = answers.themes.filter((t) => members.has(t));

  // Raw signals → percentiles across the universe (theme fit and income stay absolute).
  const growthPct = percentiles(new Map(companies.map((c) => [c.id, revenueCagr(c)])));
  const qualityPct = percentiles(new Map(companies.map((c) => [c.id, netMargin(c)])));
  const steadyPct = percentiles(new Map(companies.map((c) => [c.id, steadinessRaw(c)])));
  const themeFit = (id: string) => (chosenThemes.length ? Math.max(0, ...chosenThemes.map((t) => members.get(t)!.get(id) ?? 0)) : null);

  // Exclusions.
  const excluded: IdeaResult['excluded'] = [];
  const risky = (code: string) => countryRisk(code).tier !== 'low';
  const riskyTie = new Map<string, string>();
  if (answers.avoidHighRiskJurisdictions) {
    for (const r of relationships) {
      if (r.type !== 'supplier' || !byId.has(r.source) || !byId.has(r.target)) continue;
      const s = byId.get(r.source)!;
      const t = byId.get(r.target)!;
      if (risky(s.hq.countryCode) && effectiveMateriality(r, t.id) >= 0.6) riskyTie.set(t.id, `depends on ${s.shortName} (${s.hq.country})`);
      if (risky(t.hq.countryCode) && effectiveMateriality(r, s.id) >= 0.6) riskyTie.set(s.id, `sells heavily to ${t.shortName} (${t.hq.country})`);
    }
  }

  const heldWeight = new Map(portfolio?.companies.map((r) => [r.id, r.weight]) ?? []);
  const heavyDeps = new Map((portfolio?.dependencies ?? []).filter((d) => d.reach > 0.25).map((d) => [d.id, d.reach]));
  const heldSectors = new Map(portfolio?.sectors.map((s) => [s.sector, s.weight]) ?? []);
  const tolerance = Math.min(0.95, RISK_TOLERANCE[answers.swings] + HORIZON_ADJUST[answers.horizon]);

  // Weights: drop signals with no meaning for this user (no themes chosen → no theme weight).
  const baseWeights = { ...GOAL_WEIGHTS[answers.goal] };
  if (!chosenThemes.length) baseWeights.theme = 0;

  const scored: CompanyIdea[] = [];
  for (const c of companies) {
    if (answers.avoidSectors.includes(c.sector)) {
      excluded.push({ id: c.id, why: `${c.sector} excluded` });
      continue;
    }
    if (answers.avoidHighRiskJurisdictions && (risky(c.hq.countryCode) || riskyTie.has(c.id))) {
      excluded.push({ id: c.id, why: risky(c.hq.countryCode) ? `headquartered in ${c.hq.country}` : riskyTie.get(c.id)! });
      continue;
    }
    const l = lenses.byId.get(c.id);
    if (!l) continue;
    const tf = themeFit(c.id);
    // A theme-seeker gets nothing outside their themes.
    if (chosenThemes.length && !tf) continue;

    const signals: Record<Signal, number | null> = {
      growth: growthPct.get(c.id) ?? null,
      opportunity: l.opportunityPct,
      steadiness: steadyPct.get(c.id) ?? null,
      income: incomeRaw(c),
      quality: qualityPct.get(c.id) ?? null,
      theme: tf,
    };
    // Missing signals count as the median, as in the lenses.
    let fit = 0;
    let wsum = 0;
    const parts: { s: Signal; pts: number }[] = [];
    for (const [s, w] of Object.entries(baseWeights) as [Signal, number][]) {
      if (w <= 0) continue;
      const v = signals[s] ?? 0.5;
      fit += w * v;
      wsum += w;
      parts.push({ s, pts: w * v });
    }
    fit = wsum ? fit / wsum : 0;

    const watchouts: string[] = [];
    const over = l.riskPct - tolerance;
    if (over > 0) {
      fit -= RISK_PENALTY * over * 0.5;
      watchouts.push(`Risk lens ${Math.round(l.risk)}/100, above what you said you’re comfortable with`);
    }
    // Steer away from doubling up on what the portfolio already holds or depends on.
    const held = heldWeight.get(c.id) ?? 0;
    if (held > 0.03) {
      fit -= 0.15;
      watchouts.push(`Already ${pct(held)} of your portfolio`);
    }
    const sharedDep = lenses.byId.get(c.id)?.riskDrivers.find((d) => heavyDeps.has(d.counterpartyId));
    if (sharedDep) {
      fit -= 0.08;
      watchouts.push(`Adds to your existing dependence on ${byId.get(sharedDep.counterpartyId)?.shortName ?? sharedDep.counterpartyId}`);
    }
    const sectorShare = heldSectors.get(c.sector);
    const diversifies = portfolio && portfolio.total > 0 && (sectorShare ?? 0) < 0.1;
    if (diversifies) fit += 0.04;

    // Watch-outs from the Risk lens's biggest drivers.
    for (const d of l.riskDrivers.slice(0, 2)) watchouts.push(`${d.reason}: ${byId.get(d.counterpartyId)?.shortName ?? d.counterpartyId}`);
    if (l.opportunityCoverage < 0.5) watchouts.push('Few mapped relationships, so lens scores are partly estimated');

    scored.push({
      id: c.id,
      fit: Math.max(0, Math.min(100, fit * 100)),
      reasons: reasonsFor(c, parts, signals, l, chosenThemes, members, byId, diversifies ? c.sector : null),
      watchouts: [...new Set(watchouts)].slice(0, 3),
      signals,
    });
  }
  scored.sort((a, b) => b.fit - a.fit);

  // ---- Funds: holdings-weighted company fit ----
  const companyFit = new Map(scored.map((s) => [s.id, s.fit]));
  const excludedIds = new Set(excluded.map((e) => e.id));
  const fundIdeas: FundIdea[] = [];
  let fundsUnavailable = 0;
  if (answers.prefer !== 'stocks') {
    for (const f of funds) {
      if (!f.holdings.length) {
        fundsUnavailable++;
        continue;
      }
      const mappedW = f.holdings.reduce((a, h) => a + h.weight, 0);
      if (mappedW < 0.3) continue;
      let fit = 0;
      let themeShare = 0;
      let excludedShare = 0;
      for (const h of f.holdings) {
        fit += h.weight * (companyFit.get(h.id) ?? 35);
        if (chosenThemes.length) themeShare += h.weight * (themeFit(h.id) ?? 0);
        if (excludedIds.has(h.id)) excludedShare += h.weight;
      }
      fit /= mappedW;
      const reasons: string[] = [];
      const watchouts: string[] = [];
      if (chosenThemes.length) {
        const share = themeShare / mappedW;
        fit = 0.6 * fit + 40 * share;
        reasons.push(`${pct(share)} of mapped holdings fit your themes`);
      }
      if (excludedShare > 0.05) {
        fit -= 30 * excludedShare;
        watchouts.push(`${pct(excludedShare)} in holdings you asked to avoid`);
      }
      const overlap = portfolio ? f.holdings.reduce((a, h) => a + Math.min(h.weight, heldWeight.get(h.id) ?? 0), 0) : 0;
      if (overlap > 0.2) {
        fit -= 20 * overlap;
        watchouts.push(`Overlaps ${pct(overlap)} with what you already hold`);
      }
      const top = f.holdings.slice(0, 3).map((h) => byId.get(h.id)?.shortName ?? h.id);
      reasons.push(`Largest holdings: ${top.join(', ')}`);
      if (f.unmappedWeight > 0.3) watchouts.push(`${pct(f.unmappedWeight)} of assets are outside this map and not analyzed`);
      fundIdeas.push({ ticker: f.ticker, fit: Math.max(0, Math.min(100, fit)), reasons, watchouts });
    }
    fundIdeas.sort((a, b) => b.fit - a.fit);
  }

  return {
    companies: answers.prefer === 'funds' ? [] : scored.slice(0, limits.companies),
    funds: fundIdeas.slice(0, limits.funds),
    excluded,
    fundsUnavailable,
  };
}

function reasonsFor(
  c: Company,
  parts: { s: Signal; pts: number }[],
  signals: Record<Signal, number | null>,
  l: CompanyLens,
  themes: string[],
  members: Map<string, Map<string, number>>,
  byId: Map<string, Company>,
  diversifiesSector: Sector | null,
): string[] {
  const out: string[] = [];
  for (const { s } of [...parts].sort((a, b) => b.pts - a.pts)) {
    const v = signals[s];
    if (v == null || v < 0.55) continue;
    switch (s) {
      case 'growth': {
        const g = revenueCagr(c);
        if (g != null) out.push(`Revenue growing ${signed(g)} a year`);
        break;
      }
      case 'opportunity': {
        const d = l.opportunityDrivers[0];
        out.push(d ? `${d.reason}: ${byId.get(d.counterpartyId)?.shortName ?? d.counterpartyId}` : `Opportunity lens ${Math.round(l.opportunity)}/100`);
        break;
      }
      case 'steadiness':
        out.push('Steady revenue and consistent profits');
        break;
      case 'income': {
        const d = dividendProfile(c);
        if (d?.pays) out.push(d.raises >= 2 ? `Pays a dividend, raised ${d.raises} years running` : 'Pays a dividend');
        break;
      }
      case 'quality': {
        const m = netMargin(c);
        if (m != null) out.push(`Net margin ${pct(m)}`);
        break;
      }
      case 'theme': {
        const t = themes.find((id) => members.get(id)!.get(c.id));
        if (t) out.push(members.get(t)!.get(c.id) === 1 ? `Core ${THEME_BY_ID.get(t)!.label} company` : `In the ${THEME_BY_ID.get(t)!.label} supply chain`);
        break;
      }
    }
    if (out.length >= 3) break;
  }
  if (diversifiesSector && out.length < 3) out.push(`Adds ${diversifiesSector}, which you hold little of`);
  return out;
}
