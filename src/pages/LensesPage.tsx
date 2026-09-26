import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { RotateCcw } from 'lucide-react';
import { useTheme } from '@/design-system';
import { useAppStore, useCompanyIndex, useFilteredData, useLenses, useMetrics, usePortfolio, useScenario } from '@/app/store';
import { isDefaultFilters } from '@/data/filters';
import { pairKey } from '@/data/graph';
import {
  DEFAULT_LENS_WEIGHTS,
  FACTOR_META,
  OPPORTUNITY_FACTORS,
  RISK_FACTORS,
  SINGLE_SOURCE,
  STANCE_META,
  type CompanyLens,
  type FactorKey,
  type LensKind,
  type Stance,
} from '@/data/lenses';
import { SECTORS, type Company } from '@/data/schema';
import { LENS_LABEL, lensColor, sectorColor, stanceColor } from '@/lib/colors';
import { SECTOR_SHORT } from '@/lib/sectorLabels';
import { formatNumber, formatPercent } from '@/lib/format';
import { Badge, Button, Slider, Text, TickerMark } from '@/components/atoms';
import { ConnectionRow, Legend, SegmentedControl, StatTile } from '@/components/molecules';
import { SCENARIO_PRESETS } from '@/data/scenarioPresets';
import { exposureImpact } from '@/data/scenarios';
import { countryName, exposureOf } from '@/data/portfolio';
import {
  ChartCard,
  CompanyTable,
  DataTable,
  LensBarChart,
  LensQuadrantChart,
  ScenarioPanel,
  type LensBar,
} from '@/components/organisms';
import { DashboardLayout } from '@/components/templates';
import styles from './LensesPage.module.css';

const STANCES: Stance[] = ['add', 'watch', 'hold', 'reduce'];
const TOP = 12;

export function LensesPage() {
  const { tokens } = useTheme();
  const navigate = useNavigate();
  const filters = useAppStore((s) => s.filters);
  const weights = useAppStore((s) => s.lensWeights);
  const dataset = useAppStore((s) => s.dataset)!;
  const { select, selectEdge, setLens, setLensWeight, resetLensWeights, resetFilters, setScenario, setOverlay } = useAppStore.getState();
  const scenarioChoice = useAppStore((s) => s.scenario);
  const { analysis: portfolio } = usePortfolio();
  const filtered = useFilteredData()!;
  const metrics = useMetrics(filtered)!;
  const lenses = useLenses(filtered, metrics)!;
  const scenario = useScenario(filtered)!;
  const index = useCompanyIndex();
  const [tuning, setTuning] = useState<LensKind>('risk');

  const scored = useMemo(
    () => filtered.companies.map((c) => ({ company: c, lens: lenses.byId.get(c.id)! })).filter((x) => x.lens),
    [filtered, lenses],
  );
  const name = (id: string) => index.get(id)?.shortName ?? id;

  const toGraph = (id: string, kind: LensKind) => {
    setLens(kind);
    select(id);
    navigate('/explore');
  };
  const toEdge = (a: string, b: string, origin: string) => {
    setLens(tuning);
    select(origin);
    selectEdge(pairKey(a, b), origin);
    navigate('/explore');
  };

  /** One-line reason for a company's score: its top driver, else its top factor. */
  const topReason = (l: CompanyLens, kind: LensKind) => {
    const d = (kind === 'risk' ? l.riskDrivers : l.opportunityDrivers)[0];
    if (d) return `${d.reason}: ${name(d.counterpartyId)}`;
    const f = [...(kind === 'risk' ? l.riskFactors : l.opportunityFactors)].sort((a, b) => b.contribution - a.contribution)[0];
    return f ? f.label : '';
  };

  const bars = (items: typeof scored, kind: LensKind): LensBar[] =>
    items.map(({ company: c, lens: l }) => ({
      key: c.id,
      label: c.shortName,
      value: kind === 'risk' ? l.risk : l.opportunity,
      color: lensColor(kind, kind === 'risk' ? l.riskPct : l.opportunityPct, tokens),
      tooltipTitle: c.name,
      rows: [
        { label: 'Stance', value: STANCE_META[l.stance].label, color: stanceColor(l.stance, tokens) },
        { label: 'Top driver', value: topReason(l, kind) },
      ],
    }));

  const byStance = useMemo(() => {
    const m = new Map<Stance, typeof scored>(STANCES.map((s) => [s, []]));
    for (const x of scored) m.get(x.lens.stance)!.push(x);
    return m;
  }, [scored]);
  const toAdd = useMemo(
    () => [...byStance.get('add')!].sort((a, b) => b.lens.opportunity - a.lens.opportunity).slice(0, TOP),
    [byStance],
  );
  const toReduce = useMemo(
    () => [...byStance.get('reduce')!].sort((a, b) => b.lens.risk - a.lens.risk).slice(0, TOP),
    [byStance],
  );
  const riskiest = useMemo(() => [...scored].sort((a, b) => b.lens.risk - a.lens.risk)[0], [scored]);
  const bestOpp = useMemo(() => [...scored].sort((a, b) => b.lens.opportunity - a.lens.opportunity)[0], [scored]);

  // Share of market cap sitting in the top risk quartile.
  const capAtRisk = useMemo(() => {
    const total = scored.reduce((a, x) => a + x.company.marketCap, 0);
    const top = scored.filter((x) => x.lens.riskPct >= 0.75).reduce((a, x) => a + x.company.marketCap, 0);
    return total ? top / total : 0;
  }, [scored]);

  // Links that move a company's score most, for the lens being tuned.
  const links = useMemo(() => {
    const relById = new Map(filtered.relationships.map((r) => [r.id, r]));
    return [...lenses.byRel.values()]
      .filter((r) => r[tuning] > 0 && relById.has(r.relId))
      .sort((a, b) => b[tuning] - a[tuning])
      .slice(0, 10)
      .map((r) => {
        const rel = relById.get(r.relId)!;
        const forId = (tuning === 'risk' ? r.riskFor : r.opportunityFor)!;
        return { rel, forId, otherId: rel.source === forId ? rel.target : rel.source, value: r[tuning], reason: (tuning === 'risk' ? r.riskReason : r.opportunityReason)! };
      });
  }, [lenses, filtered, tuning]);

  const sectorBars = useMemo<LensBar[]>(() => {
    const acc = new Map<string, { sum: number; n: number; cap: number }>();
    for (const x of scored) {
      const a = acc.get(x.company.sector) ?? { sum: 0, n: 0, cap: 0 };
      // Market-cap weighted, so the sector average reflects where the money is.
      a.sum += (tuning === 'risk' ? x.lens.risk : x.lens.opportunity) * x.company.marketCap;
      a.cap += x.company.marketCap;
      a.n++;
      acc.set(x.company.sector, a);
    }
    const rows = SECTORS.filter((s) => acc.has(s)).map((s) => ({ s, v: acc.get(s)!.sum / Math.max(acc.get(s)!.cap, 1e-9), n: acc.get(s)!.n }));
    const sorted = [...rows].sort((a, b) => b.v - a.v);
    return sorted.map((r, i) => ({
      key: r.s,
      label: SECTOR_SHORT[r.s],
      value: r.v,
      color: lensColor(tuning, sorted.length > 1 ? 1 - i / (sorted.length - 1) : 0.5, tokens),
      tooltipTitle: r.s,
      rows: [{ label: 'Companies', value: r.n, color: sectorColor(r.s, tokens) }],
    }));
  }, [scored, tuning, tokens]);

  const factorKeys: readonly FactorKey[] = tuning === 'risk' ? RISK_FACTORS : OPPORTUNITY_FACTORS;
  const tuningWeights = weights[tuning] as Record<FactorKey, number>;
  const defaultWeights = DEFAULT_LENS_WEIGHTS[tuning] as Record<FactorKey, number>;
  const weightsChanged = factorKeys.some((k) => tuningWeights[k] !== defaultWeights[k]);

  const stanceLegend = STANCES.map((s) => ({
    key: s,
    label: STANCE_META[s].label,
    color: stanceColor(s, tokens),
    value: byStance.get(s)!.length,
  }));

  return (
    <DashboardLayout
      eyebrow="Lenses"
      title="Where the upside and the exposure are"
      description="Two rule-based lenses on the network. Risk scores how exposed a company is through its suppliers, customers, partners and competitors. Opportunity scores how well those ties position it to grow. Scores are ranked among the companies in view and follow the Explore filters."
      actions={
        !isDefaultFilters(filters) && (
          <>
            <Badge tone="accent">Filtered view</Badge>
            <Button size="sm" variant="ghost" leadingIcon={RotateCcw} onClick={resetFilters}>Reset filters</Button>
          </>
        )
      }
      summary={
        <div className={styles.kpis}>
          <StatTile
            label="Upside, lower risk"
            value={formatNumber(byStance.get('add')!.length)}
            caption={toAdd[0] ? `Strongest: ${toAdd[0].company.shortName}` : 'None in view'}
            onClick={toAdd[0] ? () => toGraph(toAdd[0].company.id, 'opportunity') : undefined}
            emphasis="hero"
          />
          <StatTile
            label="Higher risk, less upside"
            value={formatNumber(byStance.get('reduce')!.length)}
            caption={toReduce[0] ? `Strongest: ${toReduce[0].company.shortName}` : 'None in view'}
            onClick={toReduce[0] ? () => toGraph(toReduce[0].company.id, 'risk') : undefined}
            emphasis="hero"
          />
          <StatTile
            label="Highest risk"
            value={riskiest?.company.shortName ?? '—'}
            leading={riskiest && <TickerMark ticker={riskiest.company.ticker ?? riskiest.company.shortName} color={sectorColor(riskiest.company.sector, tokens)} size="sm" />}
            caption={riskiest ? `Risk ${Math.round(riskiest.lens.risk)} · ${topReason(riskiest.lens, 'risk')}` : undefined}
            onClick={riskiest ? () => toGraph(riskiest.company.id, 'risk') : undefined}
            emphasis="hero"
          />
          <StatTile
            label="Top opportunity"
            value={bestOpp?.company.shortName ?? '—'}
            leading={bestOpp && <TickerMark ticker={bestOpp.company.ticker ?? bestOpp.company.shortName} color={sectorColor(bestOpp.company.sector, tokens)} size="sm" />}
            caption={bestOpp ? `Opportunity ${Math.round(bestOpp.lens.opportunity)} · ${topReason(bestOpp.lens, 'opportunity')}` : undefined}
            onClick={bestOpp ? () => toGraph(bestOpp.company.id, 'opportunity') : undefined}
            emphasis="hero"
          />
          <StatTile
            label="Single-source links"
            value={formatNumber(lenses.singleSourceCount)}
            caption={`${formatPercent(capAtRisk)} of market cap is in the top risk quartile`}
            emphasis="hero"
          />
        </div>
      }
    >
      <ChartCard
        span={2}
        title="Risk against opportunity"
        description="Each bubble is a company, sized by market cap. Dashed lines mark the medians. Top-left is upside with contained risk; bottom-right is exposure without upside. Click a company to see it in the graph."
        table={() => (
          <DataTable
            columns={['Company', 'Stance', 'Risk', 'Opportunity']}
            rows={[...scored]
              .sort((a, b) => b.company.marketCap - a.company.marketCap)
              .map((x) => [x.company.shortName, STANCE_META[x.lens.stance].label, Math.round(x.lens.risk), Math.round(x.lens.opportunity)])}
          />
        )}
        footnote={<Legend orientation="horizontal" entries={stanceLegend} />}
      >
        <LensQuadrantChart
          data={scored.map((x) => ({ company: x.company, ...x.lens }))}
          tokens={tokens}
          onSelect={(id) => navigate(`/company/${encodeURIComponent(id)}`)}
        />
      </ChartCard>

      <ChartCard
        title="Tune the lenses"
        description="How much each factor counts. Scores, stances and every chart on this page update as you move them."
        actions={
          <SegmentedControl
            size="sm"
            label="Lens to tune"
            value={tuning}
            onChange={setTuning}
            options={[{ value: 'risk', label: 'Risk' }, { value: 'opportunity', label: 'Opportunity' }]}
          />
        }
        footnote={
          weightsChanged && (
            <Button size="sm" variant="ghost" leadingIcon={RotateCcw} onClick={() => resetLensWeights(tuning)}>
              Reset {LENS_LABEL[tuning].toLowerCase()} weights
            </Button>
          )
        }
      >
        <div className={styles.weights}>
          {factorKeys.map((k) => (
            <div key={k} className={styles.weight}>
              <Slider
                label={FACTOR_META[k].label}
                value={tuningWeights[k]}
                min={0}
                max={2}
                step={0.25}
                onChange={(v) => setLensWeight(tuning, k, v)}
                format={(v) => (v === 0 ? 'Off' : `×${v.toFixed(2).replace(/0$/, '')}`)}
              />
              <Text as="p" variant="caption" tone="tertiary">{FACTOR_META[k].description}</Text>
            </div>
          ))}
        </div>
      </ChartCard>

      <ChartCard
        title="Upside with lower risk"
        description="Above-median opportunity with below-median risk, ranked by opportunity."
        table={() => (
          <DataTable
            columns={['Company', 'Opportunity', 'Risk', 'Top driver']}
            rows={toAdd.map((x) => [x.company.shortName, Math.round(x.lens.opportunity), Math.round(x.lens.risk), topReason(x.lens, 'opportunity')])}
          />
        )}
      >
        <LensBarChart data={bars(toAdd, 'opportunity')} valueLabel="Opportunity" ariaLabel="Upside with lower risk, by opportunity" onSelect={(id) => toGraph(id, 'opportunity')} />
      </ChartCard>

      <ChartCard
        title="Risk without the upside"
        description="Above-median risk without above-median opportunity, ranked by risk."
        table={() => (
          <DataTable
            columns={['Company', 'Risk', 'Opportunity', 'Top driver']}
            rows={toReduce.map((x) => [x.company.shortName, Math.round(x.lens.risk), Math.round(x.lens.opportunity), topReason(x.lens, 'risk')])}
          />
        )}
      >
        <LensBarChart data={bars(toReduce, 'risk')} valueLabel="Risk" ariaLabel="Risk without the upside, by risk" onSelect={(id) => toGraph(id, 'risk')} />
      </ChartCard>

      <ChartCard
        title={tuning === 'risk' ? 'Riskiest dependencies' : 'Strongest tailwinds'}
        description={
          tuning === 'risk'
            ? `Relationships that add the most to a company’s risk. Suppliers at strength ${SINGLE_SOURCE} or above count as near single-source.`
            : 'Relationships that add the most to a company’s opportunity.'
        }
        table={() => (
          <DataTable
            columns={['Company', 'Counterparty', 'Why', 'Relative weight']}
            rows={links.map((l) => [name(l.forId), name(l.otherId), l.reason, l.value.toFixed(2)])}
          />
        )}
      >
        {links.length ? (
          <div>
            {links.map((l) => {
              const c = index.get(l.forId) as Company;
              return (
                <ConnectionRow
                  key={l.rel.id}
                  ticker={c.ticker ?? c.shortName}
                  name={`${c.shortName} via ${name(l.otherId)}`}
                  color={sectorColor(c.sector, tokens)}
                  relation={l.reason}
                  direction={l.rel.source === l.forId ? 'out' : l.rel.type === 'partner' || l.rel.type === 'competitor' ? 'both' : 'in'}
                  weight={l.value}
                  onClick={() => toEdge(l.rel.source, l.rel.target, l.forId)}
                />
              );
            })}
          </div>
        ) : (
          <Text tone="tertiary">No relationships in view.</Text>
        )}
      </ChartCard>

      <ChartCard
        title={`${LENS_LABEL[tuning]} by sector`}
        description="Market-cap weighted average score for each sector in view. Switch lenses with the control on “Tune the lenses”."
        table={() => <DataTable columns={['Sector', 'Score']} rows={sectorBars.map((b) => [b.tooltipTitle ?? b.label, Math.round(b.value)])} />}
      >
        <LensBarChart data={sectorBars} valueLabel={`${LENS_LABEL[tuning]} (cap-weighted)`} ariaLabel={`${LENS_LABEL[tuning]} by sector`} />
      </ChartCard>

      <ChartCard
        span={3}
        title="Stress test"
        description="What happens to the network if one part of it breaks? Pick a scenario to see who is hit, through which relationships, and how hard."
      >
        <ScenarioPanel
          presets={SCENARIO_PRESETS}
          value={scenarioChoice}
          onChange={setScenario}
          result={scenario}
          companyIndex={index}
          tokens={tokens}
          searchItems={filtered.companies.map((c) => ({ id: c.id, ticker: c.ticker ?? c.shortName, label: c.shortName, sublabel: c.industry, color: sectorColor(c.sector, tokens) }))}
          countries={[...new Set(filtered.companies.map((c) => c.hq.countryCode))].sort().map((code) => ({ code, label: countryName(code).replace(/^the /, '') }))}
          portfolioImpact={portfolio && portfolio.total > 0 ? exposureImpact(scenario, exposureOf(portfolio)) : null}
          onShowOnGraph={() => {
            setOverlay('scenario');
            navigate('/explore');
          }}
          onSelectCompany={(id) => navigate(`/company/${encodeURIComponent(id)}`)}
        />
      </ChartCard>

      <ChartCard span={2} title="All companies" description="Sortable. Select a row to open the company’s profile, where the scorecard explains each score.">
        <CompanyTable
          companies={filtered.companies}
          metrics={metrics}
          tokens={tokens}
          lenses={lenses}
          defaultSort="stance"
          onRowClick={(id) => navigate(`/company/${encodeURIComponent(id)}`)}
        />
      </ChartCard>

      <p className={styles.footnote}>
        Rule-based signals computed from the relationship map and SEC financials as of {dataset.asOf}. They are not investment advice.{' '}
        <Link to="/data#lenses" className={styles.link}>How the lenses work</Link>
      </p>
    </DashboardLayout>
  );
}
