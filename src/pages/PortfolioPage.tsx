import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Network, Sparkles, Wallet } from 'lucide-react';
import { useTheme } from '@/design-system';
import { useAppStore, useCompanyIndex, useFunds, usePortfolio } from '@/app/store';
import { countryRisk } from '@/data/countryRisk';
import { countryName, LIMITS, type Position } from '@/data/portfolio';
import { SCENARIO_PRESETS } from '@/data/scenarioPresets';
import { exposureImpact, runScenario } from '@/data/scenarios';
import { DEFAULT_FILTERS } from '@/data/filters';
import { lensColor, sectorColor } from '@/lib/colors';
import { SECTOR_SHORT } from '@/lib/sectorLabels';
import { formatPercent } from '@/lib/format';
import { Badge, Button, Text } from '@/components/atoms';
import { ConnectionRow, EmptyState, StatTile } from '@/components/molecules';
import { ChartCard, DataTable, LensBarChart, PositionInput } from '@/components/organisms';
import { DashboardLayout } from '@/components/templates';
import styles from './PortfolioPage.module.css';

const EXAMPLES: { label: string; positions: Position[] }[] = [
  {
    label: 'Big tech',
    positions: ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'META'].map((id) => ({ kind: 'stock' as const, id, amount: 1000 })),
  },
  {
    label: 'Chips',
    positions: ['NVDA', 'AMD', 'AVGO', 'QCOM', 'INTC', 'MU'].map((id) => ({ kind: 'stock' as const, id, amount: 1000 })),
  },
  {
    label: 'Dividend payers',
    positions: ['KO', 'PG', 'JNJ', 'XOM', 'VZ', 'PEP', 'JPM'].map((id) => ({ kind: 'stock' as const, id, amount: 1000 })),
  },
];

const SEVERITY_TONE = { high: 'critical', medium: 'warning', info: 'neutral' } as const;

export function PortfolioPage() {
  const { tokens } = useTheme();
  const navigate = useNavigate();
  const dataset = useAppStore((s) => s.dataset)!;
  const positions = useAppStore((s) => s.positions);
  const { setPositions, setOverlay, select, setScenario } = useAppStore.getState();
  const index = useCompanyIndex();
  const { list: funds } = useFunds();
  const { analysis: a } = usePortfolio();
  const name = (id: string) => index.get(id)?.shortName ?? id;

  const searchItems = useMemo(
    () =>
      dataset.companies.map((c) => ({
        id: c.id,
        ticker: c.ticker ?? c.shortName,
        label: c.shortName,
        sublabel: `${c.industry} · ${c.hq.countryCode}`,
        color: sectorColor(c.sector, tokens),
        keywords: [c.name, ...c.aliases],
      })),
    [dataset, tokens],
  );
  const examples = useMemo(
    () => EXAMPLES.map((e) => ({ ...e, positions: e.positions.filter((p) => index.has(p.id)) })).filter((e) => e.positions.length >= 3),
    [index],
  );

  // Every stress test, applied to this portfolio.
  const stress = useMemo(() => {
    if (!a || !a.total) return [];
    const rels = dataset.relationships.filter((r) => r.confidence >= DEFAULT_FILTERS.minConfidence);
    const exposure = new Map(a.companies.map((r) => [r.id, r.weight]));
    return SCENARIO_PRESETS.map((p) => {
      const res = runScenario(p.shock, dataset.companies, rels);
      const hit = a.companies
        .map((r) => ({ id: r.id, v: r.weight * (res.impacts.get(r.id)?.impact ?? 0) }))
        .filter((x) => x.v > 0)
        .sort((x, y) => y.v - x.v);
      return { preset: p, impact: exposureImpact(res, exposure), top: hit.slice(0, 3).map((x) => name(x.id)) };
    }).sort((x, y) => y.impact - x.impact);
    // name() reads the stable company index.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a, dataset]);

  const has = !!a && a.total > 0;
  const topDep = a?.dependencies.find((d) => !d.alsoHeld);
  const maxSector = Math.max(1e-9, ...(a?.sectors.map((s) => s.weight) ?? [0]));
  const risky = a?.jurisdictions.filter((j) => j.tier !== 'low') ?? [];

  return (
    <DashboardLayout
      eyebrow="Portfolio"
      title="What your holdings are really exposed to"
      description="Add the stocks and funds you hold. Funds are looked through to the companies inside them, and the relationship map shows what those companies depend on: suppliers, customers and places you don’t hold directly but are exposed to anyway."
      actions={
        has && (
          <>
            <Button size="sm" variant="secondary" leadingIcon={Network} onClick={() => { setOverlay('portfolio'); navigate('/explore'); }}>Show on graph</Button>
            <Button size="sm" variant="secondary" leadingIcon={Sparkles} onClick={() => navigate('/ideas')}>Find ideas that fit</Button>
          </>
        )
      }
      summary={
        has && (
          <div className={styles.kpis}>
            <StatTile label="Companies looked through" value={a!.companies.length} caption={`${formatPercent(a!.mapped)} of the portfolio mapped`} emphasis="hero" />
            <StatTile
              label="Biggest hidden dependency"
              value={topDep ? name(topDep.id) : '—'}
              caption={topDep ? `${formatPercent(topDep.reach)} of holdings depend on it` : 'None found'}
              onClick={topDep ? () => { select(topDep.id); navigate('/explore'); } : undefined}
              emphasis="hero"
            />
            <StatTile label="Risk lens" value={a!.scores.risk != null ? Math.round(a!.scores.risk) : '—'} caption="Exposure-weighted, 0–100" emphasis="hero" />
            <StatTile label="Opportunity lens" value={a!.scores.opportunity != null ? Math.round(a!.scores.opportunity) : '—'} caption="Exposure-weighted, 0–100" emphasis="hero" />
            <StatTile
              label="Worst stress test"
              value={stress[0] ? formatPercent(stress[0].impact) : '—'}
              caption={stress[0]?.preset.label}
              onClick={stress[0] ? () => { setScenario({ preset: stress[0].preset.id }); navigate('/lenses'); } : undefined}
              emphasis="hero"
            />
          </div>
        )
      }
    >
      <ChartCard title="Your positions" description="Stocks from the map, and funds whose holdings SEC publishes.">
        <PositionInput
          positions={positions}
          onChange={setPositions}
          companyIndex={index}
          searchItems={searchItems}
          funds={funds}
          tokens={tokens}
          examples={examples}
        />
        {funds.length > 0 && funds.every((f) => !f.holdings.length) && (
          <Text as="p" variant="caption" tone="tertiary" className={styles.note}>
            Fund holdings aren’t loaded in this build yet. See <Link to="/data#portfolio" className={styles.link}>Data</Link> for how they’re sourced from SEC N-PORT filings.
          </Text>
        )}
      </ChartCard>

      {!has ? (
        <ChartCard span={2} title="Look-through" description="Your exposure will show here.">
          <EmptyState icon={Wallet} title="No positions yet" description="Add a few stocks or funds on the left, or load an example." />
        </ChartCard>
      ) : (
        <>
          <ChartCard span={2} title="What to look at" description="Concentrations the look-through found. Thresholds are listed on the Data page.">
            {a!.warnings.length === 0 ? (
              <Text tone="secondary" variant="bodySm">Nothing crosses the concentration thresholds.</Text>
            ) : (
              <ul className={styles.warnings}>
                {a!.warnings.map((w) => (
                  <li key={`${w.kind}:${w.subject}`} className={styles.warning}>
                    <Badge tone={SEVERITY_TONE[w.severity]} dot>{w.severity === 'info' ? 'Note' : w.severity === 'high' ? 'High' : 'Medium'}</Badge>
                    <Text variant="bodySm">{w.message}</Text>
                  </li>
                ))}
              </ul>
            )}
          </ChartCard>

          <ChartCard
            title="Hidden dependencies"
            description={`Companies your holdings rely on as suppliers or customers. Bars show the share of the portfolio with a material tie (strength ≥ ${LIMITS.materialTie}).`}
            table={() => (
              <DataTable
                columns={['Depended on', 'Share with a material tie', 'Weighted exposure', 'Also held']}
                rows={a!.dependencies.slice(0, 20).map((d) => [name(d.id), formatPercent(d.reach), formatPercent(d.exposure, 1), d.alsoHeld ? 'Yes' : 'No'])}
              />
            )}
          >
            <div>
              {a!.dependencies.slice(0, 8).map((d) => {
                const c = index.get(d.id)!;
                const via = [...new Set(d.holdings.filter((h) => h.materiality >= LIMITS.materialTie).map((h) => name(h.id)))].slice(0, 3);
                return (
                  <ConnectionRow
                    key={d.id}
                    ticker={c.ticker ?? c.shortName}
                    name={c.shortName}
                    color={sectorColor(c.sector, tokens)}
                    relation={`${formatPercent(d.reach)} of portfolio${d.alsoHeld ? ' · also held' : ''}`}
                    hint={via.length ? `via ${via.join(', ')}` : undefined}
                    direction="in"
                    weight={Math.min(1, d.reach)}
                    onClick={() => navigate(`/company/${encodeURIComponent(d.id)}`)}
                  />
                );
              })}
            </div>
          </ChartCard>

          <ChartCard
            title="Stress tests on your holdings"
            description="Share of the portfolio hit by each scenario, weighted by how hard each holding is hit."
            table={() => <DataTable columns={['Scenario', 'Impact', 'Most exposed holdings']} rows={stress.map((s) => [s.preset.label, formatPercent(s.impact, 1), s.top.join(', ')])} />}
          >
            <LensBarChart
              data={stress.map((s) => ({
                key: s.preset.id,
                label: s.preset.label.replace(/ (disruption|slowdown|limits|shortfall)$/, ''),
                value: s.impact * 100,
                color: lensColor('risk', Math.min(0.95, s.impact * 2.5), tokens),
                tooltipTitle: s.preset.label,
                rows: s.top.length ? [{ label: 'Most exposed', value: s.top.join(', ') }] : [],
              }))}
              max={Math.max(10, Math.ceil((stress[0]?.impact ?? 0) * 10) * 10)}
              valueLabel="Impact (%)"
              ariaLabel="Portfolio impact by scenario"
              onSelect={(id) => { setScenario({ preset: id }); navigate('/lenses'); }}
            />
          </ChartCard>

          <ChartCard
            title="Where it sits"
            description="Headquarters, plus the places your holdings depend on through material supplier and customer ties."
            table={() => <DataTable columns={['Country', 'Share of portfolio', 'Risk tier']} rows={a!.jurisdictions.map((j) => [countryName(j.code), formatPercent(j.weight), j.tier])} />}
          >
            <LensBarChart
              data={a!.jurisdictions.slice(0, 8).map((j) => ({
                key: j.code,
                label: countryName(j.code).replace(/^the /, ''),
                value: j.weight * 100,
                color: lensColor('risk', countryRisk(j.code).score, tokens),
                rows: [{ label: 'Risk tier', value: j.tier }],
              }))}
              valueLabel="Share of portfolio (%)"
              ariaLabel="Portfolio by jurisdiction"
            />
            {risky.length > 0 && (
              <Text as="p" variant="caption" tone="tertiary" className={styles.note}>
                Higher-risk jurisdictions: {risky.map((j) => `${countryName(j.code)} ${formatPercent(j.weight)}`).join(' · ')}
              </Text>
            )}
          </ChartCard>

          <ChartCard
            title="Sectors"
            description="Look-through share of the portfolio in each sector."
            table={() => <DataTable columns={['Sector', 'Share']} rows={a!.sectors.map((s) => [s.sector, formatPercent(s.weight, 1)])} />}
          >
            <LensBarChart
              data={a!.sectors.map((s) => ({ key: s.sector, label: SECTOR_SHORT[s.sector], value: s.weight * 100, color: sectorColor(s.sector, tokens), tooltipTitle: s.sector }))}
              max={Math.ceil(maxSector * 10) * 10}
              valueLabel="Share (%)"
              ariaLabel="Portfolio by sector"
            />
          </ChartCard>

          <ChartCard span={a!.overlaps.length ? 2 : 3} title="Look-through holdings" description="Every company you hold, directly or through funds.">
            <DataTable
              columns={['Company', 'Share', 'Held through']}
              rows={a!.companies.slice(0, 60).map((r) => [
                name(r.id),
                formatPercent(r.weight, 1),
                r.via.map((v) => (v.source === 'direct' ? 'Direct' : v.source)).join(', '),
              ])}
            />
          </ChartCard>

          {a!.overlaps.length > 0 && (
            <ChartCard title="Fund overlap" description="Share of holdings two funds have in common.">
              <DataTable columns={['Funds', 'Shared']} rows={a!.overlaps.map((o) => [`${o.a} + ${o.b}`, formatPercent(o.shared)])} />
            </ChartCard>
          )}
        </>
      )}

      <p className={styles.footnote}>
        Educational look-through, not investment advice. It uses the relationships recorded in this map, which are incomplete, and fund holdings from the latest SEC filings. We’re not a licensed adviser; talk to one before making investment decisions.
      </p>
    </DashboardLayout>
  );
}
