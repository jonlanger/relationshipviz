import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  BookOpenCheck,
  Briefcase,
  Compass,
  FileSearch,
  GitCompare,
  Handshake,
  Landmark,
  Layers,
  Lightbulb,
  Network,
  PieChart,
  Scale,
  ShieldAlert,
  Sparkles,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { useAppStore, useCompanyIndex } from '@/app/store';
import { useTheme } from '@/design-system';
import { DEFAULT_FILTERS } from '@/data/filters';
import { computeMetrics } from '@/data/metrics';
import { computeLenses, SINGLE_SOURCE } from '@/data/lenses';
import { runScenario } from '@/data/scenarios';
import { SCENARIO_PRESETS } from '@/data/scenarioPresets';
import type { Company, Relationship, RelationshipType } from '@/data/schema';
import { relationshipColor, RELATIONSHIP_LABEL, sectorColor } from '@/lib/colors';
import { formatNumber, formatPercent } from '@/lib/format';
import { Icon, TickerMark } from '@/components/atoms';
import styles from './HomePage.module.css';

const TOP = 8;
const MIX_TYPES: RelationshipType[] = ['supplier', 'partner', 'investor', 'competitor'];

interface Sticky {
  company: Company;
  /** Chokepoint percentile, 0–100. */
  score: number;
  critical: number;
  customers: number;
  degree: number;
  explain: string;
}

/**
 * Everything on the home page comes from the dataset, scored over the whole universe at the
 * default confidence bar (the same base the Portfolio page uses).
 */
function useHomeData() {
  const dataset = useAppStore((s) => s.dataset)!;
  const weights = useAppStore((s) => s.lensWeights);
  return useMemo(() => {
    const { companies } = dataset;
    const relationships = dataset.relationships.filter((r) => r.confidence >= DEFAULT_FILTERS.minConfidence);
    const metrics = computeMetrics(companies, relationships);
    const lenses = computeLenses(companies, relationships, metrics, weights);
    const byId = new Map(companies.map((c) => [c.id, c]));

    const sticky: Sticky[] = companies
      .map((c) => {
        const f = lenses.byId.get(c.id)?.opportunityFactors.find((x) => x.key === 'chokepoint');
        const supplies = relationships.filter((r) => r.type === 'supplier' && r.source === c.id);
        return {
          company: c,
          raw: f?.raw ?? null,
          score: Math.round((f?.score ?? 0) * 100),
          critical: supplies.filter((r) => r.weight >= SINGLE_SOURCE).length,
          customers: supplies.length,
          degree: metrics.byId.get(c.id)?.degree ?? 0,
          explain: f?.explain ?? '',
        };
      })
      .filter((x) => x.raw != null)
      .sort((a, b) => b.raw! - a.raw! || b.degree - a.degree)
      .slice(0, TOP);

    const betweennessRank = new Map(
      [...metrics.byId.entries()].sort((a, b) => b[1].betweenness - a[1].betweenness).map(([id], i) => [id, i + 1]),
    );
    const compare = sticky.slice(0, 3).map(({ company: c }) => {
      const rels = relationships.filter((r) => r.source === c.id || r.target === c.id);
      const mix = MIX_TYPES.map((t) => ({ type: t, count: rels.filter((r) => r.type === t).length }));
      const countries = new Set(rels.map((r) => byId.get(r.source === c.id ? r.target : r.source)?.hq.countryCode).filter(Boolean));
      return {
        company: c,
        mix,
        total: rels.length,
        countries: countries.size,
        rank: betweennessRank.get(c.id) ?? 0,
        verified: rels.filter((r) => r.detail?.provenance === 'verified').length,
      };
    });

    const preset = SCENARIO_PRESETS[0];
    const scenario = runScenario(preset.shock, companies, relationships);
    const knockOn = [...scenario.impacts.values()].filter((i) => i.hop > 0).sort((a, b) => b.impact - a.impact);

    const typeCount = (t: RelationshipType) => relationships.filter((r) => r.type === t).length;

    return {
      companies,
      relationships,
      byId,
      sticky,
      compare,
      hero: heroGraph(sticky[0]?.company.id, companies, relationships),
      countries: new Set(companies.map((c) => c.hq.countryCode)).size,
      singleSource: lenses.singleSourceCount,
      counts: { supplier: typeCount('supplier'), partner: typeCount('partner'), investor: typeCount('investor') },
      stress: { preset, shocked: scenario.shocked, knockOn },
    };
  }, [dataset, weights]);
}

interface HeroNode { id: string; x: number; y: number; r: number; company: Company; ring: 0 | 1 | 2 }
interface HeroEdge { a: HeroNode; b: HeroNode; strong: boolean }

/** A radial ego network: the stickiest company, its counterparties, and theirs. Deterministic. */
/** Short on-graph label: the ticker when it reads as one, else the short name. */
const nodeLabel = (c: Company) => (c.ticker && /^[A-Z.]{1,6}$/.test(c.ticker) ? c.ticker : c.shortName);

function heroGraph(hubId: string | undefined, companies: Company[], relationships: Relationship[]) {
  const byId = new Map(companies.map((c) => [c.id, c]));
  const hub = hubId ? byId.get(hubId) : undefined;
  if (!hub) return null;
  const C = 300;
  const neighbors = (id: string) => relationships.filter((r) => r.source === id || r.target === id).map((r) => (r.source === id ? r.target : r.source));
  const ring1 = [...new Set(neighbors(hub.id))].filter((id) => byId.has(id)).slice(0, 14);
  const ring1Set = new Set([hub.id, ...ring1]);
  const ring2: { id: string; parent: string }[] = [];
  for (const p of ring1) {
    for (const id of neighbors(p)) {
      if (ring2.length >= 22) break;
      if (!ring1Set.has(id) && byId.has(id) && !ring2.some((x) => x.id === id)) ring2.push({ id, parent: p });
    }
  }
  const maxCap = Math.max(...[hub.id, ...ring1, ...ring2.map((x) => x.id)].map((id) => byId.get(id)!.marketCap), 1);
  const size = (c: Company, base: number) => base + 9 * Math.sqrt(c.marketCap / maxCap);

  const nodes = new Map<string, HeroNode>();
  nodes.set(hub.id, { id: hub.id, x: C, y: C, r: 26, company: hub, ring: 0 });
  ring1.forEach((id, i) => {
    const a = (i / ring1.length) * Math.PI * 2 - Math.PI / 2;
    nodes.set(id, { id, x: C + Math.cos(a) * 150, y: C + Math.sin(a) * 150, r: size(byId.get(id)!, 6), company: byId.get(id)!, ring: 1 });
  });
  // Spread the outer ring evenly, ordered by the angle of each node's inner-ring parent.
  const angleOf = (id: string) => Math.atan2(nodes.get(id)!.y - C, nodes.get(id)!.x - C);
  const outer = [...ring2].sort((a, b) => angleOf(a.parent) - angleOf(b.parent));
  const offset = outer.length ? angleOf(outer[0].parent) : 0;
  outer.forEach(({ id }, i) => {
    const a = offset + (i / outer.length) * Math.PI * 2;
    nodes.set(id, { id, x: C + Math.cos(a) * 250, y: C + Math.sin(a) * 250, r: size(byId.get(id)!, 3), company: byId.get(id)!, ring: 2 });
  });
  const edges: HeroEdge[] = [];
  const seen = new Set<string>();
  for (const r of relationships) {
    const a = nodes.get(r.source);
    const b = nodes.get(r.target);
    const k = [r.source, r.target].sort().join('|');
    if (!a || !b || seen.has(k)) continue;
    seen.add(k);
    edges.push({ a, b, strong: a.ring === 0 || b.ring === 0 });
  }
  return { nodes: [...nodes.values()], edges, hub };
}

export function HomePage() {
  const data = useHomeData();
  const { tokens } = useTheme();
  const index = useCompanyIndex();
  const navigate = useNavigate();
  const select = useAppStore((s) => s.select);
  const name = (id: string) => index.get(id)?.shortName ?? id;
  const openOnGraph = (id: string) => {
    select(id);
    navigate('/explore');
  };
  const hub = data.sticky[0];

  return (
    <main className={styles.page}>
      {/* ---------------- Hero ---------------- */}
      <section className={styles.hero}>
        <div className={styles.heroGlow} aria-hidden />
        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>
              <span className={styles.eyebrowDot} /> Relationship intelligence for investors
            </span>
            <h1 className={styles.heroTitle}>
              The best companies are the <em>hardest to replace.</em>
            </h1>
            <p className={styles.heroLede}>
              Deals, customer trust and strategic backing all flow along relationships between companies. RelationshipViz maps{' '}
              {formatNumber(data.relationships.length)} of them across {formatNumber(data.companies.length)} companies, so you can see
              which businesses the rest of the market can’t do without.
            </p>
            <div className={styles.heroCtas}>
              <a href="#stickiest" className={styles.ctaPrimary}>
                See the stickiest companies <Icon icon={ArrowRight} size="sm" />
              </a>
              <Link to="/explore" className={styles.ctaSecondary}>
                <Icon icon={Network} size="sm" /> Explore the network
              </Link>
            </div>
            <dl className={styles.heroStats}>
              <Stat value={formatNumber(data.companies.length)} label="companies mapped" />
              <Stat value={formatNumber(data.relationships.length)} label="sourced relationships" />
              <Stat value={formatNumber(data.countries)} label="countries" />
              <Stat value={formatNumber(data.singleSource)} label="single-source dependencies" />
            </dl>
          </div>

          {data.hero && (
            <figure className={styles.heroViz} aria-label={`${data.hero.hub.shortName} and the companies connected to it`}>
              <svg viewBox="0 0 600 600" className={styles.heroSvg} role="img">
                <title>{`${data.hero.hub.shortName}’s relationship network`}</title>
                <circle cx="300" cy="300" r="150" className={styles.orbit} />
                <circle cx="300" cy="300" r="250" className={styles.orbit} />
                {data.hero.edges.map((e, i) => (
                  <line
                    key={i}
                    x1={e.a.x}
                    y1={e.a.y}
                    x2={e.b.x}
                    y2={e.b.y}
                    className={e.strong ? styles.edgeStrong : styles.edge}
                    style={{ animationDelay: `${(i % 12) * 0.35}s` }}
                  />
                ))}
                {data.hero.nodes.map((n, i) => (
                  <g
                    key={n.id}
                    className={styles.node}
                    style={{ animationDelay: `${0.2 + n.ring * 0.25 + (i % 7) * 0.04}s` }}
                    onClick={() => navigate(`/company/${n.id}`)}
                  >
                    {n.ring === 0 && <circle cx={n.x} cy={n.y} r={n.r + 14} className={styles.hubHalo} />}
                    <circle
                      cx={n.x}
                      cy={n.y}
                      r={n.r}
                      fill={n.ring === 0 ? 'var(--color-accent-default)' : sectorColor(n.company.sector, tokens)}
                      fillOpacity={n.ring === 2 ? 0.55 : 1}
                    />
                    {n.ring === 0 ? (
                      <text x={n.x} y={n.y + 4} textAnchor="middle" className={styles.hubLabel}>
                        {nodeLabel(n.company)}
                      </text>
                    ) : (
                      n.ring === 1 && (
                        <text x={n.x} y={n.y - n.r - 6} textAnchor="middle" className={styles.nodeLabel}>
                          {nodeLabel(n.company)}
                        </text>
                      )
                    )}
                    <title>{n.company.name}</title>
                  </g>
                ))}
              </svg>
              <figcaption className={styles.heroCaption}>
                <strong>{data.hero.hub.shortName}</strong> ranks #1 for stickiness in this dataset. {hub?.explain}
              </figcaption>
            </figure>
          )}
        </div>
      </section>

      {/* ---------------- Thesis ---------------- */}
      <section className={styles.band}>
        <div className={styles.container}>
          <p className={styles.kicker}>Why relationships</p>
          <h2 className={styles.statement}>
            Earnings tell you how a company did. <span>Relationships tell you why it will keep winning.</span>
          </h2>
          <div className={styles.pillars}>
            <Pillar
              icon={Handshake}
              value={formatNumber(data.counts.supplier)}
              label="supply links"
              title="Deals follow dependence"
              body="When a customer can’t switch suppliers, the supplier sets terms. Sole-source and single-supplier ties are where pricing power lives."
            />
            <Pillar
              icon={Users}
              value={formatNumber(data.counts.partner)}
              label="partnerships"
              title="Trust compounds"
              body="Long-running partnerships with the biggest names are a public vote of confidence, and they’re hard for a rival to unwind."
            />
            <Pillar
              icon={Landmark}
              value={formatNumber(data.counts.investor)}
              label="equity stakes"
              title="Backing shows commitment"
              body="Strategic investors put capital behind the companies they need. Who owns a stake in whom shows where support will come from."
            />
          </div>
        </div>
      </section>

      {/* ---------------- Stickiest leaderboard ---------------- */}
      <section className={styles.section} id="stickiest">
        <div className={styles.container}>
          <header className={styles.sectionHead}>
            <p className={styles.kicker}>The stickiest companies</p>
            <h2 className={styles.sectionTitle}>Who the network can’t do without.</h2>
            <p className={styles.sectionLede}>
              Stickiness ranks suppliers by how many customers depend on them, how critically, and how often they bridge otherwise separate
              parts of the market. Every number traces back to a sourced relationship.
            </p>
          </header>
          <ol className={styles.board}>
            {data.sticky.map((s, i) => (
              <li key={s.company.id}>
                <Link to={`/company/${s.company.id}`} className={styles.boardRow}>
                  <span className={styles.rank}>{String(i + 1).padStart(2, '0')}</span>
                  <TickerMark ticker={s.company.ticker ?? s.company.shortName} color={sectorColor(s.company.sector, tokens)} />
                  <span className={styles.boardName}>
                    <strong>{s.company.shortName}</strong>
                    <span>{s.company.industry} · {s.company.hq.country}</span>
                  </span>
                  <span className={styles.boardFacts}>
                    <span><strong>{s.customers}</strong> customers</span>
                    <span><strong>{s.critical}</strong> critical</span>
                    <span><strong>{s.degree}</strong> ties</span>
                  </span>
                  <span className={styles.meter} aria-label={`Stickiness ${s.score} of 100`}>
                    <span className={styles.meterTrack}>
                      <span className={styles.meterFill} style={{ width: `${s.score}%` }} />
                    </span>
                    <span className={styles.meterValue}>{s.score}</span>
                  </span>
                  <Icon icon={ArrowUpRight} size="sm" className={styles.rowArrow} />
                </Link>
              </li>
            ))}
          </ol>
          <div className={styles.sectionFoot}>
            <Link to="/lenses" className={styles.textLink}>
              Rank every company on risk and opportunity <Icon icon={ArrowRight} size="sm" />
            </Link>
          </div>
        </div>
      </section>

      {/* ---------------- Audiences ---------------- */}
      <section className={styles.section}>
        <div className={styles.container}>
          <header className={styles.sectionHead}>
            <p className={styles.kicker}>Built for two kinds of investor</p>
            <h2 className={styles.sectionTitle}>An edge whether you’re picking stocks or advising on them.</h2>
          </header>
          <div className={styles.audiences}>
            <article className={styles.audience}>
              <div className={styles.audienceHead}>
                <span className={styles.audienceIcon}><Icon icon={Compass} /></span>
                <div>
                  <h3>For individual investors</h3>
                  <p>Find durable companies and understand what you already own.</p>
                </div>
              </div>
              <ul className={styles.features}>
                <Feature icon={Scale} to="/lenses" title="Spot durable businesses" body="Risk and opportunity scores built from real relationships, with the reasons behind each one." />
                <Feature icon={PieChart} to="/portfolio" title="See your hidden dependencies" body="Enter your stocks and funds. Find out how much of your money quietly rests on one supplier or one country." />
                <Feature icon={Zap} to="/lenses" title="Stress-test a shock" body="What if Taiwan chip supply stopped? Watch the impact travel from company to company." />
                <Feature icon={Lightbulb} to="/ideas" title="Get ideas to research" body="Answer six questions and get a shortlist with reasons and watch-outs, never a position size." />
              </ul>
            </article>
            <article className={`${styles.audience} ${styles.audiencePro}`}>
              <div className={styles.audienceHead}>
                <span className={styles.audienceIcon}><Icon icon={Briefcase} /></span>
                <div>
                  <h3>For analysts & advisors</h3>
                  <p>Compare relationship strategies and learn from the companies doing it best.</p>
                </div>
              </div>
              <ul className={styles.features}>
                <Feature icon={GitCompare} to={hub ? `/company/${hub.company.id}` : '/explore'} title="Benchmark relationship strategy" body="Profiles break down every company’s supply chain, relationship mix and scorecard for side-by-side comparison." />
                <Feature icon={Layers} to="/insights" title="Read the whole market" body="Sector flows, supply Sankeys, network hubs and cross-border links, all following your filters." />
                <Feature icon={Network} to="/explore" title="Map any network" body="Filter by sector, relationship type and confidence. Color by community to find clusters." />
                <Feature icon={FileSearch} to="/data" title="Cite every claim" body="Each link carries its evidence: SEC filing excerpts, curated notes and researched sources." />
              </ul>
            </article>
          </div>
        </div>
      </section>

      {/* ---------------- Compare ---------------- */}
      {data.compare.length > 1 && (
        <section className={styles.section}>
          <div className={styles.container}>
            <header className={styles.sectionHead}>
              <p className={styles.kicker}>Learn from the best-connected</p>
              <h2 className={styles.sectionTitle}>Same market. Different playbooks.</h2>
              <p className={styles.sectionLede}>
                The top companies build stickiness in different ways: some through supply, some through partnerships, some through stakes.
                Compare how they do it, then apply the pattern to the companies you follow.
              </p>
            </header>
            <div className={styles.compare}>
              {data.compare.map((c) => (
                <article key={c.company.id} className={styles.compareCard}>
                  <header className={styles.compareHead}>
                    <TickerMark ticker={c.company.ticker ?? c.company.shortName} color={sectorColor(c.company.sector, tokens)} size="lg" />
                    <div>
                      <h3>{c.company.shortName}</h3>
                      <span>{c.company.industry}</span>
                    </div>
                  </header>
                  <div className={styles.mixBar} role="img" aria-label={c.mix.map((m) => `${m.count} ${RELATIONSHIP_LABEL[m.type].toLowerCase()}`).join(', ')}>
                    {c.mix.filter((m) => m.count > 0).map((m) => (
                      <span key={m.type} style={{ flexGrow: m.count, background: relationshipColor(m.type, tokens) }} />
                    ))}
                  </div>
                  <ul className={styles.mixLegend}>
                    {c.mix.map((m) => (
                      <li key={m.type}>
                        <span className={styles.swatch} style={{ background: relationshipColor(m.type, tokens) }} />
                        {RELATIONSHIP_LABEL[m.type]}
                        <strong>{m.count}</strong>
                      </li>
                    ))}
                  </ul>
                  <dl className={styles.compareStats}>
                    <div><dt>Relationships</dt><dd>{c.total}</dd></div>
                    <div><dt>Countries reached</dt><dd>{c.countries}</dd></div>
                    <div><dt>Bridging rank</dt><dd>#{c.rank}</dd></div>
                    <div><dt>Verified links</dt><dd>{c.verified}</dd></div>
                  </dl>
                  <div className={styles.compareActions}>
                    <Link to={`/company/${c.company.id}`} className={styles.textLink}>
                      Full profile <Icon icon={ArrowRight} size="sm" />
                    </Link>
                    <button type="button" className={styles.textLinkMuted} onClick={() => openOnGraph(c.company.id)}>
                      On the graph
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ---------------- Stress test ---------------- */}
      {data.stress.knockOn.length > 0 && (
        <section className={styles.section}>
          <div className={styles.container}>
            <div className={styles.stress}>
              <div className={styles.stressCopy}>
                <p className={styles.kicker}><Icon icon={ShieldAlert} size="sm" /> Stress test</p>
                <h2 className={styles.stressNumber}>{data.stress.knockOn.length}</h2>
                <p className={styles.stressLine}>
                  companies feel a <strong>{data.stress.preset.label}</strong> within three steps, starting from just{' '}
                  {data.stress.shocked.length} in Taiwan.
                </p>
                <p className={styles.sectionLede}>
                  Risk doesn’t stay where it starts. Trace any shock through suppliers, customers, partners and owners, with the path behind
                  every impact.
                </p>
                <Link to="/lenses" className={styles.ctaSecondary}>
                  Run a stress test <Icon icon={ArrowRight} size="sm" />
                </Link>
              </div>
              <ol className={styles.impacts}>
                {data.stress.knockOn.slice(0, 5).map((i) => (
                  <li key={i.id}>
                    <Link to={`/company/${i.id}`} className={styles.impactRow}>
                      <span className={styles.impactName}>
                        <strong>{name(i.id)}</strong>
                        <span>
                          via {i.path.map((p) => name(p.from)).join(' → ')} · {i.hop} {i.hop === 1 ? 'step' : 'steps'}
                        </span>
                      </span>
                      <span className={styles.impactValue}>{formatPercent(i.impact)}</span>
                      <span className={styles.impactBar} style={{ width: `${Math.max(4, i.impact * 100)}%` }} />
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>
      )}

      {/* ---------------- How it works ---------------- */}
      <section className={styles.section}>
        <div className={styles.container}>
          <header className={styles.sectionHead}>
            <p className={styles.kicker}>How it works</p>
            <h2 className={styles.sectionTitle}>No black box. Just the evidence.</h2>
          </header>
          <ol className={styles.steps}>
            <Step n={1} icon={FileSearch} title="Sourced from public records" body="S&P 500 10-K filings on SEC EDGAR, company disclosures and researched reporting, merged with a hand-curated seed." />
            <Step n={2} icon={Sparkles} title="Scored with transparent rules" body="Every score is a rule you can read and a weight you can change. Missing data counts as the median, never as a verdict." />
            <Step n={3} icon={BookOpenCheck} title="Traced to the source" body="Click any relationship to see what flows, how material it is, when it started and where the claim comes from." />
          </ol>
        </div>
      </section>

      {/* ---------------- Closing CTA ---------------- */}
      <section className={styles.closing}>
        <div className={styles.container}>
          <h2 className={styles.closingTitle}>
            Follow the relationships. <em>Find the companies that matter.</em>
          </h2>
          <div className={styles.heroCtas}>
            <Link to="/explore" className={styles.ctaPrimary}>
              Start exploring <Icon icon={ArrowRight} size="sm" />
            </Link>
            <Link to="/portfolio" className={styles.ctaSecondary}>
              Check my portfolio
            </Link>
          </div>
          <p className={styles.disclaimer}>
            RelationshipViz is an educational research tool. Scores are signals for research, not investment advice. No live prices; nothing
            you enter leaves your browser. <Link to="/data">Sources & methodology</Link>
          </p>
        </div>
      </section>
    </main>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className={styles.stat}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Pillar({ icon, value, label, title, body }: { icon: LucideIcon; value: string; label: string; title: string; body: string }) {
  return (
    <article className={styles.pillar}>
      <span className={styles.pillarIcon}><Icon icon={icon} /></span>
      <p className={styles.pillarValue}>{value} <span>{label}</span></p>
      <h3>{title}</h3>
      <p>{body}</p>
    </article>
  );
}

function Feature({ icon, to, title, body }: { icon: LucideIcon; to: string; title: string; body: string }) {
  return (
    <li>
      <Link to={to} className={styles.feature}>
        <span className={styles.featureIcon}><Icon icon={icon} size="sm" /></span>
        <span>
          <strong>{title} <Icon icon={ArrowRight} size="sm" className={styles.featureArrow} /></strong>
          <span>{body}</span>
        </span>
      </Link>
    </li>
  );
}

function Step({ n, icon, title, body }: { n: number; icon: LucideIcon; title: string; body: string }) {
  return (
    <li className={styles.step}>
      <span className={styles.stepNum}>0{n}</span>
      <span className={styles.stepIcon}><Icon icon={icon} /></span>
      <h3>{title}</h3>
      <p>{body}</p>
    </li>
  );
}
