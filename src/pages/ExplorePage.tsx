import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FilterX, Layers, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import { useTheme } from '@/design-system';
import { useAppStore, useCompanyIndex, useFilteredData, useLenses, useMetrics, usePortfolio, useScenario, useScenarioShock } from '@/app/store';
import { portfolioPaint, scenarioPaint } from '@/lib/graph/overlays';
import { formatNumber } from '@/lib/format';
import { pairKey } from '@/data/graph';
import { Badge, Button, IconButton, Tooltip } from '@/components/atoms';
import { EmptyState } from '@/components/molecules';
import {
  CompanyDetailPanel,
  ErrorBoundary,
  FilterPanel,
  NetworkGraph,
  RelationshipPanel,
} from '@/components/organisms';
import { ExplorerLayout } from '@/components/templates';
import styles from './ExplorePage.module.css';

export function ExplorePage() {
  const s = useAppStore();
  const { tokens } = useTheme();
  const navigate = useNavigate();
  const filtered = useFilteredData();
  const metrics = useMetrics(filtered);
  const lenses = useLenses(filtered, metrics);
  const scenario = useScenario(filtered);
  const scenarioInfo = useScenarioShock();
  const { analysis: portfolio } = usePortfolio();
  const paint = useMemo(() => {
    if (s.overlay === 'scenario' && scenario) return scenarioPaint(scenario, tokens, scenarioInfo.label);
    if (s.overlay === 'portfolio' && portfolio?.companies.length) return portfolioPaint(portfolio, tokens);
    return null;
  }, [s.overlay, scenario, scenarioInfo.label, portfolio, tokens]);
  const index = useCompanyIndex();
  const dataset = s.dataset!;

  const selected = s.selectedId ? (index.get(s.selectedId) ?? null) : null;

  // Relationship view: every relationship between the selected pair, strongest first.
  const edge = useMemo(() => {
    if (!s.selectedEdge) return null;
    const rels = dataset.relationships
      .filter((r) => pairKey(r.source, r.target) === s.selectedEdge)
      .sort((p, q) => q.weight - p.weight);
    if (!rels.length) return null;
    const a = index.get(rels[0].source);
    const b = index.get(rels[0].target);
    return a && b ? { a, b, rels } : null;
  }, [s.selectedEdge, dataset, index]);
  const selectedRels = useMemo(
    () =>
      filtered && selected
        ? filtered.relationships.filter((r) => r.source === selected.id || r.target === selected.id)
        : [],
    [filtered, selected],
  );
  const rank = useMemo(() => {
    if (!metrics || !selected) return null;
    const own = metrics.byId.get(selected.id)?.betweenness ?? 0;
    if (own === 0) return null;
    return [...metrics.byId.values()].filter((m) => m.betweenness > own).length + 1;
  }, [metrics, selected]);

  // Zustand actions are stable references — safe to pass straight through.
  const onSelect = s.select;
  const onHover = s.hover;

  if (!filtered || !metrics) return null;

  return (
    <ExplorerLayout
      sidebarOpen={s.filtersOpen}
      sidebar={
        <FilterPanel
          companies={dataset.companies}
          relationships={dataset.relationships}
          filters={s.filters}
          tokens={tokens}
          colorBy={s.colorBy}
          lens={s.lens}
          onLens={s.setLens}
          layoutMode={s.layoutMode}
          showLabels={s.showLabels}
          showIsolated={s.showIsolated}
          onShowIsolated={s.setShowIsolated}
          onColorBy={s.setColorBy}
          onLayoutMode={s.setLayoutMode}
          onShowLabels={s.setShowLabels}
          onToggleSector={s.toggleSector}
          onSetSectors={s.setSectors}
          onToggleType={s.toggleType}
          onSetTypes={s.setTypes}
          onToggleUniverse={s.toggleUniverse}
          onSetUniverses={s.setUniverses}
          onMinMarketCap={s.setMinMarketCap}
          onMinConfidence={s.setMinConfidence}
          onReset={s.resetFilters}
        />
      }
      toolbar={
        <>
          <Tooltip content={s.filtersOpen ? 'Hide panel' : 'Show panel'} side="bottom">
            <IconButton
              variant="secondary"
              icon={s.filtersOpen ? PanelLeftClose : PanelLeftOpen}
              label={s.filtersOpen ? 'Hide filters' : 'Show filters'}
              onClick={() => s.setFiltersOpen(!s.filtersOpen)}
            />
          </Tooltip>
          <div className={styles.count} aria-live="polite">
            <strong>{formatNumber(filtered.companies.length)}</strong> companies
            <span className={styles.dot} aria-hidden>
              ·
            </span>
            <strong>{formatNumber(filtered.relationships.length)}</strong> relationships
          </div>
          {paint && (
            <div className={styles.overlay}>
              <Badge tone="accent">
                <Layers size={12} aria-hidden /> {s.overlay === 'scenario' ? scenarioInfo.label : 'Your portfolio'}
              </Badge>
              <Button size="sm" variant="ghost" leadingIcon={X} onClick={() => s.setOverlay('none')}>Clear</Button>
            </div>
          )}
        </>
      }
      canvas={
        filtered.companies.length === 0 ? (
          <EmptyState
            icon={FilterX}
            title="No companies match these filters"
            description="Widen the sector, universe or market-cap filters to bring companies back."
            action={<Button onClick={s.resetFilters}>Reset filters</Button>}
            className={styles.empty}
          />
        ) : (
          <ErrorBoundary label="the graph">
            <NetworkGraph
              dataset={dataset}
              filtered={filtered}
              metrics={metrics}
              colorBy={s.colorBy}
              lens={s.lens}
              lenses={lenses}
              paint={paint}
              showIsolated={s.showIsolated}
              layoutMode={s.layoutMode}
              showLabels={s.showLabels}
              selectedId={s.selectedId}
              selectedEdge={s.selectedEdge}
              onSelectEdge={s.selectEdge}
              hoveredId={s.hoveredId}
              onSelect={onSelect}
              onHover={onHover}
              onSectorPick={s.focusSector}
            />
          </ErrorBoundary>
        )
      }
      drawer={
        edge ? (
          <RelationshipPanel
            key={s.selectedEdge}
            a={edge.a}
            b={edge.b}
            relationships={edge.rels}
            companyIndex={index}
            tokens={tokens}
            origin={s.edgeOrigin ? index.get(s.edgeOrigin) : null}
            onBack={() => s.select(s.edgeOrigin)}
            onSelectCompany={(id) => s.select(id)}
            onClose={() => s.select(null)}
          />
        ) : (
          selected && (
            <CompanyDetailPanel
              key={selected.id}
              company={selected}
              relationships={selectedRels}
              companyIndex={index}
              metrics={metrics.byId.get(selected.id)}
              centralityRank={rank}
              totalCompanies={filtered.companies.length}
              lens={lenses?.byId.get(selected.id)}
              tokens={tokens}
              onSelectRelationship={(otherId) =>
                s.selectEdge(pairKey(selected.id, otherId), selected.id)
              }
              onHover={onHover}
              onClose={() => s.select(null)}
              onOpenProfile={(id) => navigate(`/company/${encodeURIComponent(id)}`)}
            />
          )
        )
      }
    />
  );
}
