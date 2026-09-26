import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RotateCcw } from 'lucide-react';
import { useTheme } from '@/design-system';
import { useAppStore, useCompanyIndex, useFilteredData, useMetrics } from '@/app/store';
import {
  companySupplyFlow,
  computeKpis,
  crossBorderLinks,
  degreeHistogram,
  sectorMatrix,
  sectorSupplyFlow,
  topBy,
  typeBreakdown,
} from '@/data/aggregates';
import { isDefaultFilters } from '@/data/filters';
import { SECTORS, type Sector } from '@/data/schema';
import { RELATIONSHIP_LABEL, sectorColor } from '@/lib/colors';
import { SECTOR_SHORT } from '@/lib/sectorLabels';
import { formatDecimal, formatNumber, formatPercent } from '@/lib/format';
import { Badge, Button, TickerMark } from '@/components/atoms';
import { Legend, SegmentedControl, StatTile } from '@/components/molecules';
import {
  CentralityBarChart,
  ChartCard,
  CompanyTable,
  DataTable,
  DegreeHistogram,
  RelationshipMix,
  SectorChordChart,
  SupplyFlowSankey,
  WorldFlowMap,
} from '@/components/organisms';
import { DashboardLayout } from '@/components/templates';
import styles from './InsightsPage.module.css';

export function InsightsPage() {
  const { tokens } = useTheme();
  const navigate = useNavigate();
  const filters = useAppStore((s) => s.filters);
  const selectedId = useAppStore((s) => s.selectedId);
  const dataset = useAppStore((s) => s.dataset)!;
  const { select, focusSector, resetFilters, setTypes } = useAppStore.getState();
  const filtered = useFilteredData()!;
  const metrics = useMetrics(filtered)!;
  const index = useCompanyIndex();
  const { companies, relationships } = filtered;

  const kpis = useMemo(() => computeKpis(companies, relationships, metrics), [companies, relationships, metrics]);
  const matrix = useMemo(() => sectorMatrix(companies, relationships), [companies, relationships]);
  const central = useMemo(() => topBy(companies, metrics, 'betweenness', 15), [companies, metrics]);
  const hist = useMemo(() => degreeHistogram(metrics), [metrics]);
  const mix = useMemo(() => typeBreakdown(relationships), [relationships]);
  const geo = useMemo(() => crossBorderLinks(companies, relationships), [companies, relationships]);

  const selected = selectedId ? index.get(selectedId) : undefined;
  const companyFlow = useMemo(
    () => (selected ? companySupplyFlow(selected.id, companies, relationships) : null),
    [selected, companies, relationships],
  );
  const [flowMode, setFlowMode] = useState<'sector' | 'company'>(companyFlow?.nodes.length ? 'company' : 'sector');
  const useCompanyFlow = flowMode === 'company' && companyFlow && companyFlow.nodes.length > 0;
  const flow = useMemo(
    () => (useCompanyFlow ? companyFlow! : sectorSupplyFlow(companies, relationships)),
    [useCompanyFlow, companyFlow, companies, relationships],
  );

  const toGraph = (id: string) => {
    select(id);
    navigate('/explore');
  };
  const toSector = (s: Sector) => {
    focusSector(s);
    navigate('/explore');
  };

  const presentSectors = SECTORS.filter((s) => central.some((c) => c.company.sector === s));

  return (
    <DashboardLayout
      eyebrow="Insights"
      title="How the network fits together"
      description="Who depends on whom, which sectors are intertwined, and which companies hold the network together. Every chart follows the filters you set in Explore."
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
          <StatTile label="Companies" value={formatNumber(kpis.companies)} caption={`HQs in ${kpis.countries} countries`} emphasis="hero" />
          <StatTile label="Relationships" value={formatNumber(kpis.relationships)} caption={`${formatPercent(kpis.crossBorderShare)} cross-border`} emphasis="hero" />
          <StatTile label="Avg. counterparties" value={formatDecimal(kpis.avgDegree, 1)} caption={`Network density ${formatPercent(metrics.density, 1)}`} emphasis="hero" />
          <StatTile
            label="Most central"
            value={kpis.mostCentral?.shortName ?? '—'}
            leading={kpis.mostCentral && <TickerMark ticker={kpis.mostCentral.ticker ?? kpis.mostCentral.shortName} color={sectorColor(kpis.mostCentral.sector, tokens)} size="sm" />}
            caption={kpis.mostCentral ? `Betweenness ${formatDecimal(metrics.byId.get(kpis.mostCentral.id)?.betweenness ?? 0, 3)}` : undefined}
            onClick={kpis.mostCentral ? () => toGraph(kpis.mostCentral!.id) : undefined}
            emphasis="hero"
          />
          <StatTile
            label="Most connected sector"
            value={kpis.mostConnectedSector ? SECTOR_SHORT[kpis.mostConnectedSector.sector] : '—'}
            caption={kpis.mostConnectedSector ? `${formatDecimal(kpis.mostConnectedSector.avgDegree, 1)} links per company` : undefined}
            onClick={kpis.mostConnectedSector ? () => toSector(kpis.mostConnectedSector!.sector) : undefined}
            emphasis="hero"
          />
        </div>
      }
    >
      <ChartCard
        span={2}
        title="Cross-sector dependency"
        description="Arc length is a sector's total links; ribbons connect sectors that work together. Click a sector to explore it."
        table={() => (
          <DataTable
            columns={['Sector', 'Links', 'Within sector']}
            rows={SECTORS.map((s, i) => [s, matrix[i].reduce((a, b) => a + b, 0), matrix[i][i]]).filter((r) => (r[1] as number) > 0)}
          />
        )}
      >
        <SectorChordChart matrix={matrix} tokens={tokens} onSectorPick={toSector} />
      </ChartCard>

      <div className={styles.stack}>
        <ChartCard
          title="Relationship mix"
          description="What kinds of ties make up the network."
          table={() => <DataTable columns={['Type', 'Count']} rows={mix.map((m) => [RELATIONSHIP_LABEL[m.type], m.count])} />}
        >
          <RelationshipMix data={mix} tokens={tokens} onPick={(t) => { setTypes([t]); navigate('/explore'); }} />
        </ChartCard>

        <ChartCard
          title="Connectedness"
          description="Counterparties per company. Most have a handful; a few hubs have many."
          table={() => <DataTable columns={['Counterparties', 'Companies']} rows={hist.map((h) => [h.degree, h.count])} />}
        >
          <DegreeHistogram data={hist} tokens={tokens} />
        </ChartCard>

      </div>

      <ChartCard
        span={2}
        title={useCompanyFlow ? `${selected!.shortName}'s supply chain` : 'Supply flows between sectors'}
        description={useCompanyFlow ? 'Suppliers on the left, customers on the right. Width is relationship strength.' : 'Supplier sectors on the left, the sectors they sell to on the right.'}
        actions={
          companyFlow && companyFlow.nodes.length > 0 && (
            <SegmentedControl
              size="sm"
              label="Flow scope"
              value={flowMode}
              onChange={setFlowMode}
              options={[{ value: 'sector', label: 'All sectors' }, { value: 'company', label: selected!.shortName }]}
            />
          )
        }
        table={() => (
          <DataTable
            columns={['From', 'To', 'Strength']}
            rows={flow.links.map((l) => [
              flow.nodes.find((n) => n.id === l.source)?.label ?? l.source,
              flow.nodes.find((n) => n.id === l.target)?.label ?? l.target,
              l.value.toFixed(2),
            ])}
          />
        )}
        footnote={!companyFlow?.nodes.length && 'Tip: select a company in Explore to see its own supply chain here.'}
      >
        <SupplyFlowSankey
          flow={flow}
          tokens={tokens}
          mode={useCompanyFlow ? 'company' : 'sector'}
          onNodeClick={(n) => (n.companyId ? toGraph(n.companyId) : toSector(n.sector))}
        />
      </ChartCard>

      <ChartCard
        title="Network hubs"
        description="Betweenness centrality: how often a company sits on the shortest path between two others."
        table={() => <DataTable columns={['Company', 'Sector', 'Betweenness']} rows={central.map((d) => [d.company.shortName, d.company.sector, formatDecimal(d.value, 3)])} />}
        footnote={<Legend orientation="horizontal" entries={presentSectors.map((s) => ({ key: s, label: s, color: sectorColor(s, tokens) }))} />}
      >
        <CentralityBarChart data={central} tokens={tokens} valueLabel="Betweenness" onSelect={toGraph} />
      </ChartCard>

      <ChartCard
        span={3}
        title="Where the network lives"
        description="Headquarters sized by market cap. Arcs are cross-border relationships; hover a company to isolate its links."
        table={() => (
          <DataTable
            columns={['From', 'To', 'Links']}
            rows={geo.map((g) => [`${g.source.shortName} (${g.source.hq.countryCode})`, `${g.target.shortName} (${g.target.hq.countryCode})`, g.count])}
          />
        )}
      >
        <WorldFlowMap companies={companies} links={geo} tokens={tokens} onSelect={toGraph} height={460} />
      </ChartCard>

      <ChartCard span={3} title="All companies" description="Sortable. Select a row to open the company's profile.">
        <CompanyTable companies={companies} metrics={metrics} tokens={tokens} onRowClick={(id) => navigate(`/company/${encodeURIComponent(id)}`)} />
      </ChartCard>

      <p className={styles.footnote}>
        Market caps and headcounts are approximate as of {dataset.asOf}. See Data for sources and methodology.
      </p>
    </DashboardLayout>
  );
}
