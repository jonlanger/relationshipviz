# RelationshipViz

An interactive map of how the world's largest companies work with each other: who **supplies**, **partners with**, **invests in** and **competes with** whom.

It starts with the S&P 500's largest companies plus the global and private counterparties they depend on most (TSMC, ASML, Samsung, OpenAI, …). The data model and pipeline are built to add more universes.

- **Home** (`/`): the landing page. It has a live hero network around the top-ranked company, a "stickiest companies" leaderboard (the Lenses chokepoint factor), sections for individual investors and for analysts, a three-company comparison, and a Taiwan stress-test teaser. It's all computed from the dataset. Page: `src/pages/HomePage.tsx`.
- **Explore** (`/explore`): a WebGL network graph (Sigma.js) with filters, search, three color modes (sector, relationship, Louvain community), a force-directed or cluster-by-sector layout, and a company drawer.
- **Insights**: KPIs, a sector chord diagram, supply-flow Sankey, network hubs (betweenness), a world map of cross-border links, a degree distribution, and a sortable company table. Every chart follows the Explore filters and links back into the graph.
- **Lenses**: rule-based Risk and Opportunity scores for an equity investor: where to add and where to trim. The page has a risk × opportunity quadrant with Add / Watch / Reduce / Hold stances, ranked candidates, the riskiest dependencies, and factor-weight sliders. The same lens colors the Explore graph, and each company drawer and profile gets a scorecard with the factors and relationships behind each score. Scoring lives in `src/data/lenses.ts`; country tiers in `src/data/countryRisk.ts`.
- **Stress tests** (on Lenses): "What if Taiwan chip supply stops?" traced through supplier, customer, partner and ownership links, with the path behind every impact. Presets live in `src/data/scenarioPresets.ts`, the engine in `src/data/scenarios.ts`.
- **Portfolio**: enter stocks and funds (kept in the browser only). Funds are looked through to their holdings via SEC N-PORT. It shows hidden dependencies (e.g. "67% of your holdings depend on TSMC"), jurisdictions, fund overlap, concentration warnings and stress-test impact, and can overlay the portfolio on the graph. Engine: `src/data/portfolio.ts`.
- **Ideas**: a six-question idea finder (goal, horizon, comfort with swings, themes, exclusions, stocks or funds). It returns a shortlist *to research*, with reasons and watch-outs and never a position size. Engine: `src/data/ideas.ts`, themes in `src/data/themes.ts`.
- **Company profile**: supply chain, relationship mix, investor-lens scorecard, and every relationship with its evidence.
- **Data**: sources, methodology and limitations.

## Quick start

```bash
npm install
npm run dev            # http://localhost:5173
npm run storybook      # http://localhost:6006
npm test
npm run build
```

## Data pipeline

**No keys required.** Without `SEC_USER_AGENT` the pipeline makes no automated SEC requests: it reads the on-disk cache and files you download by hand into `data/bulk/` (gitignored):

| File (download from sec.gov in a browser) | Unzip to | Used for |
|---|---|---|
| Bulk data → `companyfacts.zip` | `data/bulk/companyfacts/` | Financials, EPS and dividends for all S&P 500 companies |
| Form N-PORT Data Sets (one quarter) | `data/bulk/nport/` | Fund and ETF holdings for the Portfolio page and idea finder |
| `company_tickers_mf.json` (optional) | `data/bulk/` | Exact fund ticker → series matching |

```bash
npm run scrape:universe   # S&P 500 companies not in the curated seed (Wikipedia + Wikidata)
npm run scrape:funds      # fund holdings from data/bulk/nport/
npm run scrape:merge
```


```bash
# Full refresh: S&P 500 list (Wikipedia) → latest 10-K per company (SEC EDGAR) → merge → validate
SEC_USER_AGENT="RelationshipViz you@example.com" npm run scrape

# Rebuild public/data/dataset.json from the curated seed + cached scrapes only (no network)
npm run scrape:merge
```

| Stage | File | Output |
|---|---|---|
| Constituents | `scripts/scrape/sp500.ts` | `data/scraped/sp500.json` (ticker, GICS sector, HQ, CIK) |
| Filing mining | `scripts/scrape/edgar.ts` | `data/scraped/edgar-relationships.json`: sentences that mention another company, classified by keyword rules |
| Company profiles | `scripts/scrape/profiles.ts` | `data/scraped/profiles.json` (Wikipedia summary + Wikidata: CEO, founded, founders, subsidiaries, products) |
| Financials | `scripts/scrape/financials.ts` | `data/scraped/financials.json` (annual revenue, net income, R&D from SEC XBRL, 10-K and 20-F filers) |
| Merge + validate | `scripts/scrape/merge.ts` | `public/data/dataset.json` |

### Relationship research (what each connection means)

Each relationship can carry a `detail` block with a plain-language summary, what flows between the companies, materiality (share of revenue, deal value), start year, status (active, announced, ended or disputed), a dated timeline, and cited sources.

- **Verified research** lives in `data/seed/relationships.details.json` and `relationships.sources.json`. It was researched with web search and checked by hand, and it always wins over machine output.
- **AI research at scale**: `npm run enrich` asks Claude (Opus 5, with web search and web fetch) to research each link and record structured findings with sources. Output goes to `data/enriched/`, labeled *AI-researched · unreviewed* in the UI.

```bash
ANTHROPIC_API_KEY=… npm run enrich -- --limit 20          # top 20 un-researched links by strength
npm run enrich -- --ids tsm__supplier__nvda --force       # redo specific links
npm run enrich -- --dry-run --limit 3                     # print prompts only, no API calls
npm run scrape:merge                                      # publish
```

To promote machine research to verified after checking it, copy the entry into `data/seed/relationships.details.json` and set `"provenance": "verified"`.

- The **curated seed** lives in `data/seed/`: `companies.json` and `relationships.curated.json`. Curated relationships win on conflict. Scraped evidence is attached to them.
- HTTP responses are cached in `data/cache/` (gitignored). EDGAR requests are throttled below SEC's 10 req/s limit.
- Scraped links start at 45% confidence, so the default Explore threshold (50%) hides them. Lower the threshold to see them.
- The schema (`src/data/schema.ts`, zod) is shared by the app and the pipeline. Unknown ids, duplicates and self-loops fail validation.

### Adding companies or universes

1. Add companies to `data/seed/companies.json`. Non-S&P companies use `universe: "GLOBAL"` or `"PRIVATE"`. To add a new universe, extend `UNIVERSES` in `schema.ts`.
2. Add relationships to `data/seed/relationships.curated.json`. `customer` is accepted and normalized to a reversed `supplier`.
3. Run `npm run scrape:merge`.

## Architecture

```
src/
  design-system/     tokens (TS source of truth) → tokens.css, themes, global styles, ThemeProvider
  components/
    atoms/           Text, Heading, Button, IconButton, Badge, Tag, Swatch, TickerMark, Input, Checkbox, Toggle, Slider, Tooltip, …
    molecules/       SearchField, SegmentedControl, FilterGroup, Legend, StatTile, MetricRow, CompanyChip, ConnectionRow, EvidenceSnippet, ChartTooltip, EmptyState, SectionHeader
    organisms/       AppHeader, FilterPanel, NetworkGraph, CompanyDetailPanel, ChartCard, CompanyTable, charts/*
    templates/       ExplorerLayout, DashboardLayout
  pages/             ExplorePage, InsightsPage, LensesPage, PortfolioPage, IdeasPage, CompanyPage, AboutDataPage, NotFoundPage
  app/               App (router), AppLayout, store/ (zustand + derived selectors)
  data/              schema, loader, graph builder, filters, metrics (betweenness, Louvain), aggregates for charts, lenses (risk & opportunity scoring)
  lib/               formatting, color mapping, relation grouping, graph layouts (Web Worker), canvas drawing
scripts/             token build + scraping pipeline
```

### Conventions

- **Atomic layering**: atoms import nothing from other layers. Molecules import atoms. Organisms import molecules and atoms. Pages compose templates and organisms and are the only layer that talks to the store. Organisms receive state through props, which keeps them storybook-able.
- **Every component** has its own folder with `Component.tsx`, `Component.module.css`, `Component.stories.tsx` and `index.ts`.
- **Tokens only**: component CSS references semantic custom properties (`--color-bg-surface-1`, `--color-text-secondary`, `--space-4`, `--radius-md`, …), never raw values. Tokens are defined in `src/design-system/tokens/*.ts`. Run `npm run tokens` after editing them to regenerate `tokens.css`. Canvas, WebGL and SVG code reads the same values through `useTheme().tokens`.
- **Two themes**: dark (default) and light are each fully specified, not auto-inverted. Test both in Storybook with the toolbar theme switch.

### Data-viz rules

- The categorical palette is 8 fixed slots, validated for color-vision-deficiency separation on both theme surfaces. Colors are assigned by **entity, not rank**: a sector keeps its color whatever the filters. The three smallest GICS sectors fold into a neutral "other".
- Relationship-type colors appear only when "Color by: Relationship" is active, so they never compete with sector colors.
- Every chart ships a legend or direct labels, a hover tooltip, and a table view (the table icon on each `ChartCard`).
- Text uses text tokens. Color appears only on marks.
- Sigma's WebGL edges don't composite alpha like CSS, so edge colors are pre-blended against the canvas color (`lib/graph/drawing.ts → flatten`).

## Caveats

- Market caps and headcounts are approximate (mid-2025) and private-company values are last reported valuations. Neither is live data.
- Curated notes summarize public reporting in our own words; verify against the linked filings. Nothing here is investment advice.
# relationshipviz
