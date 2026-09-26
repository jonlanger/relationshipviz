import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Info, Pencil, RotateCcw } from 'lucide-react';
import { useTheme } from '@/design-system';
import { useAppStore, useCompanyIndex, useFunds, usePortfolio } from '@/app/store';
import { DEFAULT_ANSWERS, findIdeas, type Goal, type Horizon, type IdeaAnswers, type Prefer, type Swings } from '@/data/ideas';
import { THEMES } from '@/data/themes';
import { SECTORS, type Sector } from '@/data/schema';
import { DEFAULT_FILTERS } from '@/data/filters';
import { sectorColor } from '@/lib/colors';
import { Badge, Button, Icon, Text, Toggle } from '@/components/atoms';
import { SectionHeader } from '@/components/molecules';
import { IdeaResultCard, QuestionStepper, type Question } from '@/components/organisms';
import styles from './IdeasPage.module.css';

const GOALS: { value: Goal; label: string; description: string }[] = [
  { value: 'growth', label: 'Growth', description: 'Companies growing fast, with tailwinds from their customers and partners.' },
  { value: 'income', label: 'Income', description: 'Dividend payers with a record of raising them.' },
  { value: 'balanced', label: 'Balanced', description: 'A mix of growth, steadiness and quality.' },
  { value: 'steady', label: 'Steady', description: 'Consistent revenue and profits; fewer surprises.' },
];

/** Answers ↔ URL, so a result can be shared. Holdings are never put in the URL. */
function toParams(a: IdeaAnswers): URLSearchParams {
  const p = new URLSearchParams({ goal: a.goal, horizon: a.horizon, swings: a.swings, prefer: a.prefer });
  if (a.themes.length) p.set('themes', a.themes.join(','));
  if (a.avoidSectors.length) p.set('avoid', a.avoidSectors.join('|'));
  if (a.avoidHighRiskJurisdictions) p.set('avoidRisky', '1');
  return p;
}
function fromParams(p: URLSearchParams): IdeaAnswers | null {
  const goal = p.get('goal') as Goal | null;
  if (!goal || !GOALS.some((g) => g.value === goal)) return null;
  return {
    goal,
    horizon: (['short', 'medium', 'long'].includes(p.get('horizon') ?? '') ? p.get('horizon') : 'medium') as Horizon,
    swings: (['low', 'medium', 'high'].includes(p.get('swings') ?? '') ? p.get('swings') : 'medium') as Swings,
    prefer: (['stocks', 'funds', 'both'].includes(p.get('prefer') ?? '') ? p.get('prefer') : 'both') as Prefer,
    themes: (p.get('themes') ?? '').split(',').filter((t) => THEMES.some((x) => x.id === t)),
    avoidSectors: (p.get('avoid') ?? '').split('|').filter((s): s is Sector => (SECTORS as readonly string[]).includes(s)),
    avoidHighRiskJurisdictions: p.get('avoidRisky') === '1',
  };
}

export function IdeasPage() {
  const { tokens } = useTheme();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const dataset = useAppStore((s) => s.dataset)!;
  const answers = useAppStore((s) => s.ideaAnswers);
  const positions = useAppStore((s) => s.positions);
  const { setIdeaAnswers, select } = useAppStore.getState();
  const index = useCompanyIndex();
  const { list: funds } = useFunds();
  const { analysis: portfolio, lenses } = usePortfolio();
  const [step, setStep] = useState(0);
  const [useHoldings, setUseHoldings] = useState(true);

  // A shared link opens straight on the results.
  const fromUrl = useMemo(() => fromParams(params), [params]);
  useEffect(() => {
    if (fromUrl) setIdeaAnswers(fromUrl);
  }, [fromUrl, setIdeaAnswers]);
  const showResults = !!fromUrl;

  const questions: Question[] = [
    { id: 'goal', title: 'What do you want your money to do?', help: 'This sets what the ranking cares about most.', kind: 'single', options: GOALS },
    {
      id: 'horizon',
      title: 'When might you need this money?',
      help: 'Shorter horizons leave less time to ride out a bad stretch, so riskier names are marked down more.',
      kind: 'single',
      options: [
        { value: 'short', label: 'Within 3 years' },
        { value: 'medium', label: 'In 3 to 10 years' },
        { value: 'long', label: 'More than 10 years away' },
      ],
    },
    {
      id: 'swings',
      title: 'How would you feel if an investment fell 30% in a year?',
      kind: 'single',
      options: [
        { value: 'low', label: 'I’d lose sleep', description: 'Prefer companies with below-average risk in the Risk lens.' },
        { value: 'medium', label: 'Uncomfortable, but I’d hold', description: 'Accept moderate exposure.' },
        { value: 'high', label: 'Fine, if the long-term case holds', description: 'Accept high exposure for more upside.' },
      ],
    },
    {
      id: 'themes',
      title: 'Any themes you want to focus on?',
      help: 'Pick any number, or none to search everything. Themes include each industry’s key suppliers and customers.',
      kind: 'multi',
      options: THEMES.map((t) => ({ value: t.id, label: t.label, description: t.description })),
      noneLabel: 'No themes picked: every company in the map is considered.',
    },
    {
      id: 'avoidSectors',
      title: 'Anything you’d rather avoid?',
      help: 'Excluded sectors are removed completely.',
      kind: 'multi',
      options: SECTORS.map((s) => ({ value: s, label: s })),
      noneLabel: 'Nothing excluded.',
      extra: (
        <Toggle
          checked={answers.avoidHighRiskJurisdictions}
          onChange={(v) => setIdeaAnswers({ avoidHighRiskJurisdictions: v })}
          label="Also avoid companies based in, or heavily dependent on, higher-risk jurisdictions (e.g. Taiwan, Korea)"
        />
      ),
    },
    {
      id: 'prefer',
      title: 'Individual companies, funds, or both?',
      kind: 'single',
      options: [
        { value: 'stocks', label: 'Individual companies' },
        { value: 'funds', label: 'Funds and ETFs', description: 'Ranked by the companies they hold.' },
        { value: 'both', label: 'Both' },
      ],
    },
  ];
  const values: Record<string, string | string[]> = {
    goal: answers.goal,
    horizon: answers.horizon,
    swings: answers.swings,
    themes: answers.themes,
    avoidSectors: answers.avoidSectors,
    prefer: answers.prefer,
  };

  const hasHoldings = !!portfolio && portfolio.total > 0;
  const result = useMemo(() => {
    if (!showResults || !lenses) return null;
    const rels = dataset.relationships.filter((r) => r.confidence >= DEFAULT_FILTERS.minConfidence);
    return findIdeas(answers, dataset.companies, rels, lenses, funds, hasHoldings && useHoldings ? portfolio : null);
  }, [showResults, lenses, dataset, answers, funds, hasHoldings, useHoldings, portfolio]);

  const finish = () => setParams(toParams(answers));
  const edit = () => {
    setStep(0);
    setParams({});
  };

  const summary = [
    GOALS.find((g) => g.value === answers.goal)!.label,
    { short: 'Under 3 yrs', medium: '3–10 yrs', long: '10+ yrs' }[answers.horizon],
    { low: 'Low swings', medium: 'Moderate swings', high: 'OK with swings' }[answers.swings],
    ...answers.themes.map((t) => THEMES.find((x) => x.id === t)!.label),
    ...answers.avoidSectors.map((s) => `No ${s}`),
    ...(answers.avoidHighRiskJurisdictions ? ['Avoid higher-risk jurisdictions'] : []),
  ];

  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <Text variant="overline" tone="accent">Idea finder</Text>
          <h1 className={styles.title}>Ideas to research</h1>
          <Text as="p" variant="bodyLg" tone="secondary" className={styles.lede}>
            Answer a few questions and get a shortlist of companies and funds to look into, with the reasons they matched and what to watch. It draws on the relationship map, the Risk and Opportunity lenses and SEC financials.
          </Text>
          <div className={styles.disclaimer} role="note">
            <Icon icon={Info} size="sm" />
            <Text as="p" variant="bodySm" tone="secondary">
              This is an educational screen, not personalized investment advice. It doesn’t know your finances and never says how much to invest. We’re not a licensed adviser; talk to one before you invest.
            </Text>
          </div>
        </header>

        {!showResults ? (
          <QuestionStepper
            questions={questions}
            step={step}
            values={values}
            onChange={(id, v) => setIdeaAnswers({ [id]: v } as Partial<IdeaAnswers>)}
            onStep={(s) => setStep(Math.max(0, Math.min(questions.length - 1, s)))}
            onFinish={finish}
          />
        ) : (
          result && (
            <div className={styles.results}>
              <div className={styles.answers}>
                {summary.map((s) => <Badge key={s}>{s}</Badge>)}
                <Button size="sm" variant="ghost" leadingIcon={Pencil} onClick={edit}>Change answers</Button>
                <Button size="sm" variant="ghost" leadingIcon={RotateCcw} onClick={() => { setIdeaAnswers(DEFAULT_ANSWERS); edit(); }}>Start over</Button>
              </div>

              {hasHoldings && (
                <section className={styles.exposure} aria-labelledby="exposure-heading">
                  <div className={styles.exposureHead}>
                    <SectionHeader title="Exposure check" />
                    <Toggle checked={useHoldings} onChange={setUseHoldings} label={`Steer away from what I already hold (${positions.length} positions)`} />
                  </div>
                  <h2 id="exposure-heading" className={styles.srOnly}>Exposure check</h2>
                  {portfolio!.warnings.length ? (
                    <ul className={styles.warnings}>
                      {portfolio!.warnings.slice(0, 4).map((w) => <li key={`${w.kind}:${w.subject}`}>{w.message}</li>)}
                    </ul>
                  ) : (
                    <Text variant="bodySm" tone="secondary">Your current holdings don’t cross any concentration thresholds.</Text>
                  )}
                  <Link to="/portfolio" className={styles.link}>Full look-through on the Portfolio page</Link>
                </section>
              )}

              {answers.prefer !== 'funds' && (
                <section aria-labelledby="companies-heading" className={styles.section}>
                  <h2 id="companies-heading" className={styles.sectionTitle}>Companies to research</h2>
                  {result.companies.length === 0 ? (
                    <Text tone="secondary">No companies match all of your answers. Try fewer exclusions or another theme.</Text>
                  ) : (
                    <div className={styles.grid}>
                      {result.companies.map((idea, i) => {
                        const c = index.get(idea.id)!;
                        return (
                          <IdeaResultCard
                            key={idea.id}
                            rank={i + 1}
                            ticker={c.ticker ?? c.shortName}
                            name={c.shortName}
                            sublabel={`${c.industry} · ${c.hq.countryCode}`}
                            tickerColor={sectorColor(c.sector, tokens)}
                            fit={idea.fit}
                            reasons={idea.reasons}
                            watchouts={idea.watchouts}
                            onOpen={() => navigate(`/company/${encodeURIComponent(c.id)}`)}
                            onGraph={() => { select(c.id); navigate('/explore'); }}
                          />
                        );
                      })}
                    </div>
                  )}
                </section>
              )}

              {answers.prefer !== 'stocks' && (
                <section aria-labelledby="funds-heading" className={styles.section}>
                  <h2 id="funds-heading" className={styles.sectionTitle}>Funds to research</h2>
                  {result.funds.length === 0 ? (
                    <Text tone="secondary" variant="bodySm">
                      {result.fundsUnavailable
                        ? 'Fund holdings aren’t loaded in this build yet, so funds can’t be ranked. They come from SEC N-PORT filings; see the Data page.'
                        : 'No funds match your answers.'}
                    </Text>
                  ) : (
                    <div className={styles.grid}>
                      {result.funds.map((idea, i) => {
                        const f = funds.find((x) => x.ticker === idea.ticker)!;
                        return (
                          <IdeaResultCard
                            key={idea.ticker}
                            rank={i + 1}
                            ticker={f.ticker}
                            name={f.name}
                            sublabel={`${f.kind === 'mutual' ? 'Mutual fund' : 'ETF'}${f.asOf ? ` · holdings as of ${f.asOf}` : ''}`}
                            fit={idea.fit}
                            reasons={idea.reasons}
                            watchouts={idea.watchouts}
                          />
                        );
                      })}
                    </div>
                  )}
                </section>
              )}

              {result.excluded.length > 0 && (
                <Text as="p" variant="caption" tone="tertiary">
                  {result.excluded.length} companies left out because of your exclusions.
                </Text>
              )}
              <Text as="p" variant="caption" tone="tertiary">
                Fit is a 0–100 match to your answers, not a rating or a forecast. <Link to="/data#ideas" className={styles.link}>How ideas are ranked</Link>
              </Text>
            </div>
          )
        )}
      </div>
    </main>
  );
}
