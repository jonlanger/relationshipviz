/**
 * LLM research step: for each relationship, Claude searches the web (and reads the
 * sources it finds), then records a structured explanation — what flows, how material
 * it is, since when, current status, a dated timeline, and cited sources.
 *
 * Output (merged by scripts/scrape/merge.ts, labeled provenance "machine"):
 *   data/enriched/relationships.details.json   { [relationshipId]: RelationshipDetail }
 *   data/enriched/relationships.sources.json   { [relationshipId]: Evidence[] }
 *
 * Hand-verified research in data/seed/relationships.details.json always wins.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=… npm run enrich -- --limit 20            # top 20 un-researched links by weight
 *   npm run enrich -- --ids tsm__supplier__nvda,msft__investor__openai
 *   npm run enrich -- --dry-run --limit 3                        # print prompts, no API calls
 *   Flags: --force (redo cached) · --concurrency 3 · --effort high|medium|low
 */
import Anthropic from '@anthropic-ai/sdk';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import {
  EvidenceSchema,
  RELATIONSHIP_STATUSES,
  type Company,
  type Dataset,
  type Evidence,
  type Relationship,
  type RelationshipDetail,
} from '../../src/data/schema';
import { ENRICHED_DIR, OUT_FILE, readJson, SEED_DIR, writeJson } from '../scrape/lib';

const MODEL = 'claude-opus-5';
const DETAILS_FILE = resolve(ENRICHED_DIR, 'relationships.details.json');
const SOURCES_FILE = resolve(ENRICHED_DIR, 'relationships.sources.json');

// ---------- CLI ----------
const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes(`--${name}`);
const opt = (name: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const DRY_RUN = flag('dry-run');
const FORCE = flag('force');
const LIMIT = Number(opt('limit') ?? 10);
const IDS = opt('ids')?.split(',').map((s) => s.trim().toLowerCase());
const CONCURRENCY = Number(opt('concurrency') ?? 3);
const EFFORT = (opt('effort') ?? 'high') as 'low' | 'medium' | 'high';

// ---------- The tool Claude calls to hand back its findings ----------
const RecordInput = z.object({
  summary: z.string(),
  flows: z.array(z.string()),
  revenue_share: z
    .object({ value: z.number().min(0).max(1), of_company_id: z.string(), year: z.number().int().nullable(), basis: z.string() })
    .nullable(),
  deal_value_usd_billions: z.number().nonnegative().nullable(),
  materiality_note: z.string().nullable(),
  since_year: z.number().int().nullable(),
  status: z.enum(RELATIONSHIP_STATUSES),
  events: z.array(z.object({ date: z.string(), title: z.string(), url: z.string().nullable() })),
  sources: z.array(
    z.object({
      url: z.string(),
      title: z.string(),
      publisher: z.string().nullable(),
      date: z.string().nullable(),
      kind: z.enum(['filing', 'press', 'research']),
      supports: z.string(),
    }),
  ),
  relationship_confirmed: z.boolean(),
});
type RecordInput = z.infer<typeof RecordInput>;

const recordTool: Anthropic.Beta.BetaTool = {
  name: 'record_relationship',
  description:
    'Record the researched facts about this relationship. Call exactly once, after researching. Every factual claim must be backed by an entry in `sources`.',
  strict: true,
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: [
      'summary',
      'flows',
      'revenue_share',
      'deal_value_usd_billions',
      'materiality_note',
      'since_year',
      'status',
      'events',
      'sources',
      'relationship_confirmed',
    ],
    properties: {
      summary: {
        type: 'string',
        description: 'Two or three plain-language sentences: what the relationship is, what each side gets, and why it matters.',
      },
      flows: {
        type: 'array',
        items: { type: 'string' },
        description: 'Specific products, services, capital or IP moving between them, e.g. "3nm wafer fabrication", "HBM3E memory", "$10B equity investment".',
      },
      revenue_share: {
        type: ['object', 'null'],
        additionalProperties: false,
        required: ['value', 'of_company_id', 'year', 'basis'],
        properties: {
          value: { type: 'number', description: 'Fraction 0–1.' },
          of_company_id: { type: 'string', description: 'Id of the company whose revenue this is a share of (one of the two ids given).' },
          year: { type: ['integer', 'null'] },
          basis: { type: 'string', description: 'Where the figure comes from, e.g. "FY2025 10-K customer concentration".' },
        },
        description: 'Only when a source discloses or credibly reports it. Otherwise null.',
      },
      deal_value_usd_billions: { type: ['number', 'null'], description: 'Headline contract/investment value in USD billions, if reported.' },
      materiality_note: { type: ['string', 'null'], description: 'One sentence on how important this tie is to each side.' },
      since_year: { type: ['integer', 'null'] },
      status: { type: 'string', enum: [...RELATIONSHIP_STATUSES] },
      events: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['date', 'title', 'url'],
          properties: {
            date: { type: 'string', description: 'YYYY, YYYY-MM or YYYY-MM-DD' },
            title: { type: 'string', description: 'Short event description.' },
            url: { type: ['string', 'null'] },
          },
        },
        description: 'Key dated milestones, oldest first. Up to 6.',
      },
      sources: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['url', 'title', 'publisher', 'date', 'kind', 'supports'],
          properties: {
            url: { type: 'string' },
            title: { type: 'string' },
            publisher: { type: ['string', 'null'] },
            date: { type: ['string', 'null'] },
            kind: { type: 'string', enum: ['filing', 'press', 'research'] },
            supports: { type: 'string', description: 'Which claim this source supports, in your own words (no long quotes).' },
          },
        },
      },
      relationship_confirmed: {
        type: 'boolean',
        description: 'False if the research could not confirm the relationship exists as described.',
      },
    },
  },
};

const SYSTEM = `You research relationships between companies for a public reference dataset.

For the relationship you are given, use web search to find primary sources first (SEC filings, company press releases and investor materials), then reputable reporting. Fetch a page when a search snippet isn't enough to confirm a figure or date.

Standards:
- Only record facts a source supports. Leave a field null or empty rather than guess.
- Prefer the most recent figures and say which year they refer to.
- Describe in your own words; do not copy long passages.
- If the relationship has ended or changed (e.g. a supply deal wound down, a stake sold), say so via status and events.
- If you cannot confirm the relationship at all, set relationship_confirmed to false and explain in the summary.

When done, call record_relationship once with your findings.`;

function prompt(r: Relationship, a: Company, b: Company): string {
  const describe = (c: Company) =>
    `- ${c.name} (id: ${c.id}${c.ticker ? `, ticker ${c.ticker}` : ''}), ${c.industry}, HQ ${c.hq.city}, ${c.hq.country}`;
  return `Relationship to research:
${describe(a)}
${describe(b)}

Recorded as: ${a.shortName} —${r.type}→ ${b.shortName}
(type meanings: supplier = source supplies target; investor = source holds equity in target; subsidiary = source is owned by target; partner/competitor are symmetric)

Existing notes:
${r.evidence.map((e) => `- ${e.note}`).join('\n')}

Research this relationship and call record_relationship.`;
}

// ---------- API loop ----------
const client = DRY_RUN ? null : new Anthropic();

async function research(r: Relationship, a: Company, b: Company): Promise<RecordInput | null> {
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: 'user', content: prompt(r, a, b) }];
  for (let turn = 0; turn < 8; turn++) {
    const stream = client!.beta.messages.stream({
      model: MODEL,
      max_tokens: 32000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      thinking: { type: 'adaptive' },
      output_config: { effort: EFFORT },
      system: SYSTEM,
      tools: [
        { type: 'web_search_20260209', name: 'web_search', max_uses: 6 },
        { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 4 },
        recordTool,
      ],
      messages,
    });
    const msg = await stream.finalMessage();

    if (msg.stop_reason === 'refusal') {
      console.warn(`  ${r.id}: refused (${msg.stop_details?.category ?? 'unknown'})`);
      return null;
    }
    if (msg.stop_reason === 'max_tokens') {
      console.warn(`  ${r.id}: hit max_tokens`);
      return null;
    }
    messages.push({ role: 'assistant', content: msg.content });
    if (msg.stop_reason === 'pause_turn') continue;

    const call = msg.content.find(
      (c): c is Anthropic.Beta.BetaToolUseBlock => c.type === 'tool_use' && c.name === 'record_relationship',
    );
    if (call) {
      const parsed = RecordInput.safeParse(call.input);
      if (parsed.success) return parsed.data;
      messages.push({
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: call.id, is_error: true, content: `Invalid input: ${parsed.error.message}` }],
      });
      continue;
    }
    // Ended without recording — nudge once.
    messages.push({ role: 'user', content: 'Please call record_relationship with your findings now.' });
  }
  console.warn(`  ${r.id}: no result after max turns`);
  return null;
}

function toDetail(rec: RecordInput, r: Relationship): { detail: RelationshipDetail; sources: Evidence[] } {
  const ids = new Set([r.source, r.target]);
  const detail: RelationshipDetail = {
    summary: rec.summary,
    flows: rec.flows.slice(0, 8),
    materiality: {
      revenueShare:
        rec.revenue_share && ids.has(rec.revenue_share.of_company_id)
          ? { value: rec.revenue_share.value, of: rec.revenue_share.of_company_id, year: rec.revenue_share.year, basis: rec.revenue_share.basis }
          : null,
      dealValueUsdB: rec.deal_value_usd_billions,
      note: rec.materiality_note,
    },
    since: rec.since_year,
    status: rec.status,
    events: rec.events.slice(0, 8).map((e) => ({ date: e.date, title: e.title, url: safeUrl(e.url) })),
    provenance: 'machine',
    researchedAt: new Date().toISOString().slice(0, 10),
  };
  const sources: Evidence[] = rec.sources.flatMap((s) => {
    const parsed = EvidenceSchema.safeParse({
      url: safeUrl(s.url),
      title: s.title,
      publisher: s.publisher,
      date: s.date,
      kind: s.kind,
      note: s.supports,
    });
    return parsed.success ? [parsed.data] : [];
  });
  return { detail, sources };
}

function safeUrl(u: string | null): string | null {
  if (!u) return null;
  try {
    const url = new URL(u);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

// ---------- Main ----------
async function main() {
  const dataset = readJson<Dataset>(OUT_FILE);
  const byId = new Map(dataset.companies.map((c) => [c.id, c]));
  const verified = existsSync(resolve(SEED_DIR, 'relationships.details.json'))
    ? readJson<Record<string, unknown>>(resolve(SEED_DIR, 'relationships.details.json'))
    : {};
  const details = existsSync(DETAILS_FILE) ? readJson<Record<string, RelationshipDetail>>(DETAILS_FILE) : {};
  const sources = existsSync(SOURCES_FILE) ? readJson<Record<string, Evidence[]>>(SOURCES_FILE) : {};

  const queue = dataset.relationships
    .filter((r) => (IDS ? IDS.includes(r.id) : true))
    .filter((r) => IDS || FORCE || (!verified[r.id] && !details[r.id]))
    .filter((r) => r.confidence >= 0.5 || IDS)
    .sort((x, y) => y.weight - x.weight)
    .slice(0, IDS ? undefined : LIMIT);

  console.log(`Researching ${queue.length} relationship(s) with ${MODEL} (effort ${EFFORT})${DRY_RUN ? ' — dry run' : ''}`);
  if (DRY_RUN) {
    for (const r of queue) console.log(`\n--- ${r.id} ---\n${prompt(r, byId.get(r.source)!, byId.get(r.target)!)}`);
    return;
  }

  let done = 0;
  const work = [...queue];
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, work.length) }, async () => {
      for (let r = work.shift(); r; r = work.shift()) {
        try {
          const rec = await research(r, byId.get(r.source)!, byId.get(r.target)!);
          if (rec) {
            const out = toDetail(rec, r);
            details[r.id] = out.detail;
            sources[r.id] = out.sources;
            // Save after each result so an interrupted run keeps its progress.
            writeJson(DETAILS_FILE, details);
            writeJson(SOURCES_FILE, sources);
            console.log(`  ✓ ${r.id}${rec.relationship_confirmed ? '' : ' (NOT confirmed)'} — ${out.sources.length} sources`);
          }
        } catch (err) {
          if (err instanceof Anthropic.RateLimitError) console.warn(`  ${r.id}: rate limited — rerun later`);
          else if (err instanceof Anthropic.AuthenticationError) throw err;
          else if (err instanceof Anthropic.APIError) console.warn(`  ${r.id}: API ${err.status} ${err.message}`);
          else console.warn(`  ${r.id}: ${(err as Error).message}`);
        }
        done++;
      }
    }),
  );
  console.log(`✓ Done: ${done} processed. Run \`npm run scrape:merge\` to publish.`);
}

main().catch((err) => {
  if (err instanceof Anthropic.AuthenticationError) {
    console.error('Authentication failed — set ANTHROPIC_API_KEY (or run `ant auth login`).');
    process.exit(1);
  }
  throw err;
});
