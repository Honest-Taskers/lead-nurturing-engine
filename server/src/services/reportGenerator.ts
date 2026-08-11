import Anthropic from '@anthropic-ai/sdk';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { fetchUnsplashPhoto } from './unsplash.js';
import { sectionRole, type Lead, type ReportSection } from '../types.js';

const here = path.dirname(fileURLToPath(import.meta.url));
// Candidate roots cover local dev (src or dist next to server/) and the
// Vercel bundle, where includeFiles places server/skills relative to cwd.
const SKILL_ROOTS = [
  path.join(here, '../../skills'),
  path.join(process.cwd(), 'server/skills'),
  path.join(process.cwd(), 'skills'),
];

/** Loads a skill's SKILL.md (frontmatter stripped) to use as an agent's system prompt. */
function loadSkill(name: string): string {
  const file =
    SKILL_ROOTS.map((root) => path.join(root, name, 'SKILL.md')).find(existsSync) ??
    path.join(SKILL_ROOTS[0], name, 'SKILL.md');
  const raw = readFileSync(file, 'utf8');
  return raw.replace(/^---[\s\S]*?---\s*/, '');
}

/** Settings dropdown value → Anthropic model ID (legacy labels map to the default). */
const MODEL_MAP: Record<string, string> = {
  'claude-sonnet-5': 'claude-sonnet-5',
  'claude-opus-5': 'claude-opus-5',
  'claude-haiku-4-5': 'claude-haiku-4-5',
  // legacy values from the OpenAI phase
  'gpt-5.1': 'claude-sonnet-5',
  'gpt-5-mini': 'claude-sonnet-5',
  'gpt-4o': 'claude-sonnet-5',
  'Claude (latest)': 'claude-sonnet-5',
};
const DEFAULT_MODEL = 'claude-sonnet-5';
/** Small, fast model that audits the report against the goal rubric. */
const GOAL_CHECK_MODEL = 'claude-haiku-4-5';

export interface GenerateInput {
  lead: Lead;
  focus: string;
  template: string;
  sections: string[];
  aiPrompt: string;
  aiModel: string;
  companyName: string;
  /** Sender's "about" blurb — grounds the closing note. */
  about?: string | null;
  /** Sender brand colors (used by the PDF template, not the writer). */
  brandPrimary?: string | null;
  brandSecondary?: string | null;
}

export interface GeneratedReport {
  title: string;
  dek: string | null;
  badge: string | null;
  coverImageUrl: string | null;
  sectionImageUrl: string | null;
  imageCredit: string | null;
  sections: ReportSection[];
  publications: string[];
  model: string;
}

/**
 * anyOf-style nullability. The structured-outputs compiler caps union-typed
 * parameters at 16 per schema, so ONLY object/array fields use it; optional
 * strings are plain strings where "" means "none" (see optionalString +
 * normalizeParsed below).
 */
const nullable = (schema: Record<string, unknown>) => ({ anyOf: [schema, { type: 'null' }] });

/** Optional string without a union type: the model returns "" when not applicable. */
const optionalString = (description: string) => ({
  type: 'string',
  description: `${description}. Return an empty string if not applicable.`,
});

/**
 * Structured-output JSON schema (all properties required; optionality via null),
 * matching the editorial format defined in skills/ht-report-writer/SKILL.md.
 */
const REPORT_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Cover title expressing the thesis, sentence case, ≤10 words' },
    dek: optionalString('Subheadline expanding the title into the recipient’s stakes'),
    badge: optionalString('Sender name + month, e.g. "Honest Taskers · August 2026"'),
    coverImageQuery: optionalString(
      '2-5 word literal photo search query for the cover photograph (subject only, no style words)',
    ),
    sectionImageQuery: optionalString(
      '2-5 word literal photo search query for the feature-opener image (different subject from the cover)',
    ),
    sections: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          key: { type: 'string', description: 'Exactly the requested section name' },
          kicker: optionalString('Short navigational label, ≤4 words'),
          heading: { type: 'string' },
          body: { type: 'string' },
          bullets: nullable({ type: 'array', items: { type: 'string' } }),
          quote: nullable({
            type: 'object',
            properties: {
              text: { type: 'string' },
              attribution: { type: 'string' },
              role: optionalString('Speaker role/title'),
            },
            required: ['text', 'attribution', 'role'],
            additionalProperties: false,
          }),
          chart: nullable({
            type: 'object',
            properties: {
              question: { type: 'string', description: 'The analytical conclusion, stated as a headline' },
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    label: { type: 'string' },
                    value: { type: 'number' },
                    suffix: optionalString('Unit suffix, e.g. "%"'),
                    highlight: {
                      type: 'boolean',
                      description: 'true ONLY for the single datapoint that carries the exhibit’s conclusion',
                    },
                  },
                  required: ['label', 'value', 'suffix', 'highlight'],
                  additionalProperties: false,
                },
              },
              source: optionalString('Publication + date'),
            },
            required: ['question', 'data', 'source'],
            additionalProperties: false,
          }),
          stats: nullable({
            type: 'array',
            description: '2-4 big-number stat callouts rendered as a display strip',
            items: {
              type: 'object',
              properties: {
                value: { type: 'string', description: 'e.g. "42%"' },
                label: { type: 'string', description: 'Short one-line label' },
                source: optionalString('Publication + date'),
              },
              required: ['value', 'label', 'source'],
              additionalProperties: false,
            },
          }),
          numberedItems: nullable({
            type: 'array',
            description: 'Action-agenda items carry firstStep/kpi/timing; elsewhere those are empty strings',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string', description: 'The action (imperative, specific)' },
                body: { type: 'string', description: 'Why it matters' },
                firstStep: optionalString('The concrete first move'),
                kpi: optionalString('Proof-of-progress metric'),
                timing: optionalString('e.g. "Now (30 days)"'),
              },
              required: ['title', 'body', 'firstStep', 'kpi', 'timing'],
              additionalProperties: false,
            },
          }),
          subTopics: nullable({
            type: 'array',
            description: 'Only ONE body section: the numbered "Key questions for a {role}" sidebar',
            items: {
              type: 'object',
              properties: { title: { type: 'string' }, body: { type: 'string' } },
              required: ['title', 'body'],
              additionalProperties: false,
            },
          }),
          methodology: optionalString(
            'Closing note only: what public/company/industry information informed the report',
          ),
        },
        required: ['key', 'kicker', 'heading', 'body', 'bullets', 'quote', 'chart', 'stats', 'numberedItems', 'subTopics', 'methodology'],
        additionalProperties: false,
      },
    },
    publications: { type: 'array', items: { type: 'string' } },
  },
  required: ['title', 'dek', 'badge', 'coverImageQuery', 'sectionImageQuery', 'sections', 'publications'],
  additionalProperties: false,
} as Record<string, unknown>;

/** Goal-check verdict schema for the small-model audit. */
const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    pass: { type: 'boolean' },
    issues: { type: 'array', items: { type: 'string' } },
  },
  required: ['pass', 'issues'],
  additionalProperties: false,
} as Record<string, unknown>;

/**
 * Safety net for web-search citation artifacts: strips markdown links, bare URL
 * parentheticals, and domain-only parentheticals from generated prose (this is a
 * printed report — sources are cited by name in prose / publications / chart.source).
 */
export function stripCitations(text: string): string {
  return text
    .replace(/\[([^\]]*)\]\((?:https?:\/\/|www\.)[^)]*\)/g, '$1') // [text](url) -> text
    .replace(/\((?:\s*(?:https?:\/\/|www\.)[^()\s]+[^()]*)\)/g, '') // (https://...)
    .replace(/\(\s*[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|org|net|gov|edu|io|ai|co)\b[^()]*\)/gi, '') // (domain.com...)
    .replace(/\butm_source=\w+\S*/gi, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ +([.,;:!?])/g, '$1')
    .trim();
}

function sanitizeSections(sections: ReportSection[]): ReportSection[] {
  const clean = (s: string | null | undefined) => (s == null ? s : stripCitations(s));
  return sections.map((s) => ({
    ...s,
    heading: stripCitations(s.heading),
    body: stripCitations(s.body),
    bullets: s.bullets?.map(stripCitations).filter((b) => b.trim().length > 0) ?? s.bullets,
    quote: s.quote ? { ...s.quote, text: stripCitations(s.quote.text), attribution: stripCitations(s.quote.attribution) } : s.quote,
    chart: s.chart
      ? { ...s.chart, question: stripCitations(s.chart.question), source: clean(s.chart.source) }
      : s.chart,
    stats: s.stats?.map((t) => ({ ...t, label: stripCitations(t.label), source: clean(t.source) })) ?? s.stats,
    numberedItems:
      s.numberedItems?.map((n) => ({
        ...n,
        title: stripCitations(n.title),
        body: stripCitations(n.body),
        firstStep: clean(n.firstStep),
        kpi: clean(n.kpi),
      })) ?? s.numberedItems,
    subTopics: s.subTopics?.map((t) => ({ title: stripCitations(t.title), body: stripCitations(t.body) })) ?? s.subTopics,
    methodology: clean(s.methodology),
  }));
}

function fillTemplate(template: string, lead: Lead): string {
  return template
    .replaceAll('{title}', lead.personaTitle)
    .replaceAll('{company}', lead.organization)
    .replaceAll('{industry}', lead.industry);
}

interface ParsedReport {
  title: string;
  dek: string | null;
  badge: string | null;
  coverImageQuery?: string | null;
  sectionImageQuery?: string | null;
  sections: ReportSection[];
  publications: string[];
}

/**
 * Structural validation of a generated report against the requested sections.
 * Hard violations get one repair attempt; soft violations are logged only.
 */
export function validateReport(
  parsed: ParsedReport,
  requestedSections: string[],
): { hard: string[]; soft: string[] } {
  const hard: string[] = [];
  const soft: string[] = [];
  const keys = parsed.sections.map((s) => s.key);

  if (keys.join('|') !== requestedSections.join('|')) {
    hard.push(
      `sections must be exactly [${requestedSections.join(' | ')}] in that order; got [${keys.join(' | ')}]`,
    );
  }

  const charts = parsed.sections.filter((s) => s.chart);
  if (charts.length < 1 || charts.length > 3) {
    hard.push(`between 1 and 3 sections must carry a chart; got ${charts.length}`);
  } else {
    for (const section of charts) {
      const bars = section.chart!.data ?? [];
      if (bars.length < 3 || bars.length > 6 || bars.some((b) => typeof b.value !== 'number' || Number.isNaN(b.value))) {
        hard.push(`the chart in "${section.key}" needs 3-6 bars with numeric values; got ${bars.length}`);
      }
    }
  }

  const takeaways = parsed.sections.find((s) => sectionRole(s.key) === 'takeaways');
  if (takeaways) {
    const n = takeaways.numberedItems?.length ?? 0;
    if (n < 4 || n > 6) hard.push(`Actionable takeaways needs 4-6 numberedItems; got ${n}`);
  }

  const summary = parsed.sections.find((s) => sectionRole(s.key) === 'exec-summary');
  if (summary && !summary.body?.trim()) hard.push('Executive summary body is empty');

  const quotes = parsed.sections.filter((s) => s.quote).length;
  if (quotes < 2) soft.push(`fewer than 2 quotes (${quotes})`);
  if (parsed.title.split(/\s+/).length > 8) soft.push('title exceeds 8 words');
  if (!parsed.publications?.length) soft.push('publications list is empty');
  const unsourcedStats = parsed.sections.filter((s) => s.stats?.some((t) => !t.source?.trim())).length;
  if (unsourcedStats) soft.push(`${unsourcedStats} section(s) carry stat callouts without a source`);

  return { hard, soft };
}

/* ---------- Claude agent helpers ---------- */

/** Progress phases surfaced to the UI while a report generates. */
export type GenerationPhase = 'research' | 'writing' | 'goal-check' | 'repair' | 'images' | 'saving';

export interface GenerateOptions {
  /** Aborts in-flight model calls when the client cancels generation. */
  signal?: AbortSignal;
  /** Called as the pipeline advances so the UI can show live progress. */
  onProgress?: (phase: GenerationPhase, detail?: string) => void;
}

function textOf(message: Anthropic.Message): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');
}

function assertNotRefusal(message: Anthropic.Message, stage: string): void {
  if (message.stop_reason === 'refusal') {
    throw new Error(`${stage} was declined by the model's safety classifiers`);
  }
}

/**
 * Research agent — web-searches role- and vertical-specific findings, quotes
 * and chartable datasets, returning a plain-text research brief the writer is
 * restricted to. Handles pause_turn (server-side tool loop limit) by resuming.
 */
/** Hard wall-clock cap on the research stage (env-overridable). */
const RESEARCH_TIMEOUT_MS = Number(process.env.RESEARCH_TIMEOUT_MS ?? 240_000);

async function runResearchAgent(
  client: Anthropic,
  model: string,
  prompt: string,
  signal?: AbortSignal,
  onProgress?: GenerateOptions['onProgress'],
): Promise<string> {
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: prompt }];
  const params = () => ({
    model,
    max_tokens: 16000,
    system: loadSkill('ht-research'),
    // Research is search-and-read heavy; medium effort consolidates the tool
    // loop and keeps this stage's wall time inside the serverless budget.
    output_config: { effort: 'medium' as const },
    // The basic search variant, deliberately: the _20260209 version's dynamic
    // filtering runs a server-side code-execution sandbox that measured 4-5
    // minutes per research turn (container start + multi-minute bash runs).
    // Raw results cost more input tokens but return in seconds.
    tools: [{ type: 'web_search_20250305' as const, name: 'web_search' as const, max_uses: 8 }],
    messages,
  });

  // The stage runs under its own deadline: web-search turns have occasionally
  // stalled for many minutes, and a partial brief beats a hung generation.
  // Accumulated text is salvaged when the deadline fires mid-stream.
  const controller = new AbortController();
  const onUpstreamAbort = () => controller.abort();
  signal?.addEventListener('abort', onUpstreamAbort, { once: true });
  const deadline = setTimeout(() => controller.abort(), RESEARCH_TIMEOUT_MS);

  let salvage = '';
  let searches = 0;
  let lastDetail = '';
  const progress = (detail: string) => {
    if (detail !== lastDetail) {
      lastDetail = detail;
      onProgress?.('research', detail);
    }
  };
  const startedAt = Date.now();
  const attachInstrumentation = (stream: ReturnType<typeof client.messages.stream>) => {
    stream.on('text', (delta: string) => {
      salvage += delta;
    });
    stream.on('streamEvent', (event: Anthropic.MessageStreamEvent) => {
      if (event.type === 'content_block_start' && event.content_block.type === 'server_tool_use') {
        searches += 1;
        progress(`Running web search ${searches} of 8…`);
      }
      if (event.type === 'content_block_start' && event.content_block.type === 'text' && searches > 0) {
        progress('Compiling the research brief…');
      }
    });
    return stream;
  };

  try {
    let message = await attachInstrumentation(client.messages.stream(params(), { signal: controller.signal })).finalMessage();

    // The server-side web-search loop can pause; re-send once to resume.
    if (message.stop_reason === 'pause_turn') {
      messages.push({ role: 'assistant', content: message.content });
      message = await attachInstrumentation(client.messages.stream(params(), { signal: controller.signal })).finalMessage();
    }
    assertNotRefusal(message, 'research');
    return textOf(message);
  } catch (err) {
    // The user cancelled — propagate. Our own deadline — salvage what streamed.
    if (signal?.aborted) throw err;
    if (controller.signal.aborted && salvage.trim().length > 600) {
      console.warn(
        `research hit the ${Math.round(RESEARCH_TIMEOUT_MS / 1000)}s deadline after ${Math.round((Date.now() - startedAt) / 1000)}s; continuing with the partial brief (${salvage.length} chars)`,
      );
      return salvage;
    }
    throw err;
  } finally {
    clearTimeout(deadline);
    signal?.removeEventListener('abort', onUpstreamAbort);
  }
}

/** "" → null for the schema's optional strings (kept union-free for the schema compiler). */
function normalizeParsed(p: ParsedReport): ParsedReport {
  const nn = (v: string | null | undefined) => (v && v.trim() ? v : null);
  return {
    ...p,
    dek: nn(p.dek),
    badge: nn(p.badge),
    coverImageQuery: nn(p.coverImageQuery),
    sectionImageQuery: nn(p.sectionImageQuery),
    sections: p.sections.map((s) => ({
      ...s,
      kicker: nn(s.kicker),
      methodology: nn(s.methodology),
      quote: s.quote ? { ...s.quote, role: nn(s.quote.role) } : s.quote,
      chart: s.chart
        ? { ...s.chart, source: nn(s.chart.source), data: s.chart.data.map((d) => ({ ...d, suffix: nn(d.suffix) })) }
        : s.chart,
      stats: s.stats?.map((t) => ({ ...t, source: nn(t.source) })) ?? s.stats,
      numberedItems:
        s.numberedItems?.map((n) => ({ ...n, firstStep: nn(n.firstStep), kpi: nn(n.kpi), timing: nn(n.timing) })) ??
        s.numberedItems,
    })),
  };
}

/**
 * Writer agent — composes the report JSON from the research brief (no tools).
 * max_tokens covers adaptive thinking PLUS the JSON text; too tight a budget
 * truncates the JSON mid-string. One retry covers transient truncation.
 */
async function runWriterAgent(
  client: Anthropic,
  model: string,
  prompt: string,
  signal?: AbortSignal,
  onProgress?: GenerateOptions['onProgress'],
): Promise<ParsedReport> {
  const attempt = async (): Promise<ParsedReport> => {
    const stream = client.messages.stream(
      {
        model,
        max_tokens: 32000,
        system: loadSkill('ht-report-writer'),
        output_config: { format: { type: 'json_schema', schema: REPORT_SCHEMA } },
        messages: [{ role: 'user', content: prompt }],
      },
      { signal },
    );
    if (onProgress) {
      let chars = 0;
      let lastTick = 0;
      stream.on('text', (delta: string) => {
        chars += delta.length;
        if (Date.now() - lastTick > 3000) {
          lastTick = Date.now();
          onProgress('writing', `Drafting the briefing — about ${Math.round(chars / 6)} words so far…`);
        }
      });
    }
    const message = await stream.finalMessage();
    assertNotRefusal(message, 'report writing');
    if (message.stop_reason === 'max_tokens') {
      throw new Error('report writing hit the output token limit (truncated JSON)');
    }
    const text = textOf(message);
    try {
      return normalizeParsed(JSON.parse(text) as ParsedReport);
    } catch (err) {
      console.warn(
        `writer returned unparseable JSON (stop_reason=${message.stop_reason}, ${text.length} chars):`,
        err instanceof Error ? err.message : err,
      );
      throw err;
    }
  };

  try {
    return await attempt();
  } catch (err) {
    if (signal?.aborted) throw err;
    console.warn('writer attempt failed, retrying once:', err instanceof Error ? err.message : err);
    onProgress?.('writing', 'First draft came back malformed — rewriting…');
    return await attempt();
  }
}

/**
 * Goal-check agent — a small, cheap model audits the report against the goal
 * rubric (data integrity, length, non-salesy closing, …) and returns
 * repair-ready issues. Fail-soft: an audit failure never blocks the report.
 */
async function runGoalCheck(client: Anthropic, report: ParsedReport, signal?: AbortSignal): Promise<string[]> {
  try {
    const message = await client.messages.create(
      {
        model: GOAL_CHECK_MODEL,
        max_tokens: 2000,
        system: loadSkill('ht-goal-check'),
        output_config: { format: { type: 'json_schema', schema: VERDICT_SCHEMA } },
        messages: [{ role: 'user', content: `Report JSON to audit:\n${JSON.stringify(report)}` }],
      },
      { signal },
    );
    assertNotRefusal(message, 'goal check');
    const verdict = JSON.parse(textOf(message)) as { pass: boolean; issues: string[] };
    return verdict.pass ? [] : verdict.issues.slice(0, 8);
  } catch (err) {
    if (signal?.aborted) throw err;
    console.warn('goal check failed (continuing without):', err);
    return [];
  }
}

export async function generateReport(input: GenerateInput, options: GenerateOptions = {}): Promise<GeneratedReport> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return stubReport(input);
  }

  const { signal, onProgress } = options;
  // maxRetries 1: a silent SDK retry on a slow/overloaded request can double a
  // multi-minute stage; better to fail fast and let the repair/fallback logic run.
  const client = new Anthropic({ maxRetries: 1, timeout: 10 * 60 * 1000 });
  const model = MODEL_MAP[input.aiModel] ?? DEFAULT_MODEL;
  const { lead } = input;
  const startedAt = Date.now();

  const leadDetails = [
    'Recipient / lead details:',
    `- Persona: ${lead.personaName}, ${lead.personaTitle}`,
    `- Organization: ${lead.organization} (${lead.industry})`,
    lead.orgSize ? `- Size: ${lead.orgSize}` : null,
    lead.headquarters ? `- Headquarters: ${lead.headquarters}` : null,
    lead.locationsReach ? `- Reach: ${lead.locationsReach}` : null,
    lead.hiringSignal ? `- Hiring signal: ${lead.hiringSignal}` : null,
  ].filter((l) => l !== null);

  // 1. Research — a dedicated agent investigates the company + vertical.
  onProgress?.('research', `Researching ${lead.organization} and the ${lead.industry} vertical`);
  const researchPrompt = [
    fillTemplate(input.aiPrompt, lead),
    '',
    ...leadDetails,
    '',
    `Report focus: ${input.focus}`,
    'Research a brief for a personalized report to this recipient, per your instructions.',
  ].join('\n');
  const brief = await runResearchAgent(client, model, researchPrompt, signal, onProgress);
  console.log(`research brief ready (${brief.length} chars, ${Math.round((Date.now() - startedAt) / 1000)}s)`);

  // 2. Write — a second agent turns the brief into the structured report.
  onProgress?.('writing', 'Composing the briefing from the research');
  const writerPrompt = [
    fillTemplate(input.aiPrompt, lead),
    '',
    ...leadDetails,
    '',
    `Report focus: ${input.focus}`,
    `Template / tone: ${input.template}`,
    `Sections to produce (exactly these keys, in this order): ${input.sections.join(' | ')}`,
    `Sender company: ${input.companyName}`,
    input.about ? `About the sender (grounds the Closing note — do not sell): ${input.about}` : null,
    `Current month for the badge: ${new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase()}`,
    '',
    'Research brief (your ONLY source of facts, statistics and quotes):',
    brief,
  ]
    .filter((l) => l !== null)
    .join('\n');
  let parsed = await runWriterAgent(client, model, writerPrompt, signal, onProgress);
  console.log(`draft report ready (${Math.round((Date.now() - startedAt) / 1000)}s)`);

  // 3. Deterministic structural validation + 4. small-model goal check.
  onProgress?.('goal-check', 'Auditing the draft against the quality rubric');
  let { hard, soft } = validateReport(parsed, input.sections);
  const goalIssues = Date.now() - startedAt < 210_000 ? await runGoalCheck(client, parsed, signal) : [];
  if (goalIssues.length) console.warn('goal check issues:', goalIssues);

  // 5. One repair pass (no research — the content exists, only shape/rubric is off).
  // Skipped when the 300s serverless budget is running low; a slightly-off
  // report beats a timeout.
  const violations = [...hard, ...goalIssues];
  if (violations.length && Date.now() - startedAt < 230_000) {
    console.warn('report failed validation, attempting repair:', violations);
    onProgress?.('repair', `Fixing ${violations.length} issue${violations.length === 1 ? '' : 's'} found in review`);
    try {
      const repairPrompt = [
        'The report JSON below violates the output contract. Return a corrected version of the SAME report:',
        'fix ONLY the listed violations, changing nothing else. Do not re-research or rewrite unrelated content.',
        '',
        `Violations:\n- ${violations.join('\n- ')}`,
        '',
        `Required section keys, in order: ${input.sections.join(' | ')}`,
        '',
        'Research brief (your ONLY source of facts):',
        brief,
        '',
        `Report JSON:\n${JSON.stringify(parsed)}`,
      ].join('\n');
      const repaired = await runWriterAgent(client, model, repairPrompt, signal);
      const recheck = validateReport(repaired, input.sections);
      if (recheck.hard.length <= hard.length) {
        parsed = repaired;
        ({ hard, soft } = recheck);
      }
    } catch (err) {
      if (signal?.aborted) throw err;
      console.warn('repair pass failed (continuing with original):', err);
    }
  }
  if (hard.length) console.warn('report shipped with unresolved violations:', hard);
  if (soft.length) console.warn('report soft violations:', soft);

  // 6. Photos — fetched last so a repaired report never wastes an image.
  // The writer sometimes omits the interior query; fall back to the cover
  // subject, skipping to the SECOND search result so the two photographs are
  // never the same image.
  onProgress?.('images', 'Selecting cover and interior photography');
  const interiorQuery = parsed.sectionImageQuery ?? parsed.coverImageQuery;
  const interiorIndex = parsed.sectionImageQuery ? 0 : 1;
  const [cover, interior] = await Promise.all([
    parsed.coverImageQuery ? fetchUnsplashPhoto(parsed.coverImageQuery, 'portrait', 'cover') : null,
    interiorQuery ? fetchUnsplashPhoto(interiorQuery, 'landscape', 'section', interiorIndex) : null,
  ]);

  return {
    title: stripCitations(parsed.title),
    dek: parsed.dek ? stripCitations(parsed.dek) : null,
    badge: parsed.badge ?? null,
    coverImageUrl: cover?.url ?? null,
    sectionImageUrl: interior?.url ?? null,
    imageCredit: cover?.credit ?? interior?.credit ?? null,
    sections: sanitizeSections(parsed.sections),
    publications: (parsed.publications ?? []).map(stripCitations),
    model,
  };
}

/** Deterministic stub used when ANTHROPIC_API_KEY is not configured, so the app still demos end-to-end. */
function stubReport(input: GenerateInput): GeneratedReport {
  const { lead } = input;
  const year = new Date().getFullYear();
  const badge = `${input.companyName.toUpperCase()} · ${new Date()
    .toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    .toUpperCase()}`;
  const focusLower = input.focus.toLowerCase();
  const firstName = lead.personaName.split(' ')[0];
  const bodies: Record<string, ReportSection> = {
    'Executive summary': {
      key: 'Executive summary',
      kicker: 'EXECUTIVE SUMMARY',
      heading: `What ${year} demands of ${focusLower}`,
      body:
        `${lead.industry}s enter ${year} balancing margin pressure with rising volumes, and ${focusLower} sits squarely in the middle of both. ` +
        `For a ${lead.personaTitle} at ${lead.organization}, three forces dominate the year: staffing costs that outpace reimbursement, payer friction that lengthens every cycle, and automation moving from pilots to production.\n` +
        `This report distills what peers are measuring, where the leaders are investing, and the steps worth taking this quarter.`,
      bullets: [
        `Where ${focusLower} margins are leaking in ${year}`,
        'The workforce-readiness gap, in numbers',
        'Five moves peers are making this quarter',
      ],
    },
    'Industry overview': {
      key: 'Industry overview',
      heading: `${input.focus} transformation accelerates`,
      body: `${lead.industry}s enter ${year} balancing margin pressure with rising volumes. For ${lead.organization}, staffing costs and payer friction remain the biggest operational drags on ${focusLower} performance.\nAcross the sector, leaders describe the same pattern: volume grows, experienced staff get harder to keep, and every point of denial rate now maps directly to margin.`,
      stats: [
        { value: '48%', label: 'of leaders report rising cost to collect', source: 'HFMA, February 2026' },
        { value: '3.2×', label: 'growth in prior-auth volume since 2021', source: 'MGMA, 2025' },
        { value: '11 days', label: 'added to the average cycle by payer friction', source: 'RevCycle Intelligence, 2025' },
      ],
      quote: {
        text: 'We know we have to decrease cost to collect, and technology is a major play for how we can do that.',
        attribution: 'Industry revenue cycle leader',
        role: null,
      },
    },
    'Key trends & data': {
      key: 'Key trends & data',
      kicker: 'SURVEY QUESTION',
      heading: `Leaders fear their teams aren't ready for the ${focusLower} of the future`,
      body: 'How prepared is your current workforce for the skills required over the next five years?',
      chart: {
        question: 'How prepared is your current workforce for the skills required over the next five years?',
        data: [
          { label: 'Very prepared', value: 7.4, suffix: '%' },
          { label: 'Somewhat prepared', value: 44.2, suffix: '%' },
          { label: 'Neutral', value: 27.4, suffix: '%' },
          { label: 'Somewhat unprepared', value: 16.8, suffix: '%' },
          { label: 'Very unprepared', value: 4.2, suffix: '%' },
        ],
        source: 'HFMA Revenue Cycle of the Future survey, February 2026',
      },
    },
    'Top publications to follow': {
      key: 'Top publications to follow',
      heading: 'Top publications to follow',
      body: 'Worth a regular skim this quarter:',
      bullets: ['HFMA', "Becker's Hospital Review", 'RevCycle Intelligence'],
    },
    'Hiring / talent insight': {
      key: 'Hiring / talent insight',
      heading: 'Preparing the team for what’s next',
      body: `${lead.hiringSignal ? `With ${lead.hiringSignal.toLowerCase()}, ` : ''}competition for experienced staff remains tight. Industry experts point to three lessons learned.`,
      numberedItems: [
        { title: "Don't jump to tech first.", body: 'Start by questioning the problem you’re trying to solve before automating a broken process.' },
        { title: 'Be selective with pilots.', body: 'Work only with partners willing to ingest feedback and turn around improvement quickly.' },
        { title: 'Be brave.', body: 'With margins tight the room for error is small — but waiting too long risks falling meaningfully behind.' },
      ],
      quote: {
        text: 'The teams that keep their best people are the ones that took the volume work off their desks first.',
        attribution: 'Health system operations adviser',
        role: null,
      },
    },
    'Actionable takeaways': {
      key: 'Actionable takeaways',
      kicker: 'ACTIONABLE TAKEAWAYS',
      heading: 'Five moves worth making this quarter',
      body: `Each of these can start inside ${firstName}'s current team, without new capital budget.`,
      numberedItems: [
        { title: 'Baseline your denial codes.', body: `Pull the last 90 days of denials and rank by dollar impact. Most ${lead.industry.toLowerCase()} teams find three codes explain over half the leakage.`, firstStep: 'Export the last 90 days of denial data by code and dollar value.', kpi: 'Share of denied dollars explained by the top three codes', timing: 'Now (30 days)' },
        { title: 'Time-stamp the handoffs.', body: 'Measure elapsed time between eligibility check, authorization, and claim submission — the delays live between the steps, not inside them.', firstStep: 'Add timestamps to the three hand-off points in the workflow.', kpi: 'Median hours between eligibility check and claim submission', timing: 'Now (30 days)' },
        { title: 'Protect senior staff from volume work.', body: 'List every task your most experienced people did last week that a trained assistant could own; that list is your burnout-risk register.', firstStep: 'Run a one-week task inventory with the two most senior staff.', kpi: 'Hours per week of senior time redirected to exceptions', timing: 'Next (31–90 days)' },
        { title: 'Set a payer-response SLA.', body: 'Track payer turnaround like you track your own team. What gets measured gets escalated.', firstStep: 'Define target turnaround per payer and start a weekly scorecard.', kpi: 'Average payer response time vs. target', timing: 'Next (31–90 days)' },
        { title: 'Pilot one automation, fully.', body: 'One workflow, instrumented end-to-end, beats five half-configured tools. Pick the highest-volume, lowest-judgment task first.', firstStep: 'Select the single highest-volume, lowest-judgment workflow.', kpi: 'Touches per claim before vs. after the pilot', timing: 'Scale (6–12 months)' },
      ],
    },
    'Closing note': {
      key: 'Closing note',
      heading: 'Why this landed on your desk',
      body:
        `${input.companyName} spends its days inside ${focusLower} operations like yours — which is why reports like this one exist. ` +
        `${input.about ? input.about + ' ' : ''}No pitch attached: if the ideas here spark a question, we're genuinely glad to compare notes.\n` +
        `A fresh, ${lead.industry.toLowerCase()}-specific brief like this one lands every two weeks.`,
      bullets: [
        'Payer prior-authorization policy changes taking effect next quarter',
        'Denial-rate trend versus the sector benchmark over the next two quarters',
        'Staffing market movement for experienced revenue-cycle roles',
      ],
      methodology:
        'This briefing draws on publicly available industry research, trade publications, and government data relevant to the recipient’s vertical, combined with role-specific analysis. No private company information was used; where company metrics were unavailable, clearly labeled industry benchmarks stand in.',
    },
  };
  return {
    title: `The ${input.focus} of the Future`,
    dek: `How ${lead.organization} can seize a rare opportunity to improve the day-to-day business operations of ${lead.industry.toLowerCase()}s.`,
    badge,
    coverImageUrl: null,
    sectionImageUrl: null,
    imageCredit: null,
    sections: input.sections.map((s) => bodies[s]).filter(Boolean),
    publications: ['HFMA', "Becker's Hospital Review", 'RevCycle Intelligence'],
    model: 'stub (no ANTHROPIC_API_KEY set)',
  };
}
