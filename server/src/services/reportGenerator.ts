import OpenAI from 'openai';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { saveImage } from '../db/images.js';
import type { Lead, ReportSection } from '../types.js';

const here = path.dirname(fileURLToPath(import.meta.url));
// Candidate roots cover local dev (src or dist next to server/) and the
// Vercel bundle, where includeFiles places server/skills relative to cwd.
const SKILL_PATH = [
  path.join(here, '../../skills/ht-industry-report/SKILL.md'),
  path.join(process.cwd(), 'server/skills/ht-industry-report/SKILL.md'),
  path.join(process.cwd(), 'skills/ht-industry-report/SKILL.md'),
].find(existsSync) ?? path.join(here, '../../skills/ht-industry-report/SKILL.md');

/** Settings dropdown value → OpenAI model ID (legacy labels map to the default). */
const MODEL_MAP: Record<string, string> = {
  'gpt-5.1': 'gpt-5.1',
  'gpt-5-mini': 'gpt-5-mini',
  'gpt-4o': 'gpt-4o',
  // legacy values from earlier phases
  'claude-opus-5': 'gpt-5.1',
  'claude-sonnet-5': 'gpt-5.1',
  'claude-haiku-4-5': 'gpt-5-mini',
  'Claude (latest)': 'gpt-5.1',
};
const IMAGE_MODEL = 'gpt-image-1';

export interface GenerateInput {
  lead: Lead;
  focus: string;
  template: string;
  sections: string[];
  aiPrompt: string;
  aiModel: string;
  companyName: string;
}

export interface GeneratedReport {
  title: string;
  dek: string | null;
  badge: string | null;
  coverImageUrl: string | null;
  sections: ReportSection[];
  publications: string[];
  model: string;
}

/**
 * Strict-mode JSON schema (all properties required; optionality via null),
 * matching the editorial format defined in skills/ht-industry-report/SKILL.md.
 */
const REPORT_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Cover/feature title, ≤ 8 words' },
    dek: { type: ['string', 'null'], description: 'Italic subheadline expanding the title' },
    badge: { type: ['string', 'null'], description: 'e.g. "HONEST TASKERS · AUG 2026"' },
    coverImagePrompt: {
      type: ['string', 'null'],
      description: 'Detailed image-generation prompt for the pop-art cover illustration (no text in image)',
    },
    sections: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          key: { type: 'string', description: 'Exactly the requested section name' },
          kicker: { type: ['string', 'null'] },
          heading: { type: 'string' },
          body: { type: 'string' },
          bullets: { type: ['array', 'null'], items: { type: 'string' } },
          quote: {
            type: ['object', 'null'],
            properties: {
              text: { type: 'string' },
              attribution: { type: 'string' },
              role: { type: ['string', 'null'] },
            },
            required: ['text', 'attribution', 'role'],
            additionalProperties: false,
          },
          chart: {
            type: ['object', 'null'],
            properties: {
              question: { type: 'string' },
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    label: { type: 'string' },
                    value: { type: 'number' },
                    suffix: { type: ['string', 'null'], description: 'e.g. "%"' },
                  },
                  required: ['label', 'value', 'suffix'],
                  additionalProperties: false,
                },
              },
              source: { type: ['string', 'null'] },
            },
            required: ['question', 'data', 'source'],
            additionalProperties: false,
          },
          numberedItems: {
            type: ['array', 'null'],
            items: {
              type: 'object',
              properties: { title: { type: 'string' }, body: { type: 'string' } },
              required: ['title', 'body'],
              additionalProperties: false,
            },
          },
          subTopics: {
            type: ['array', 'null'],
            items: {
              type: 'object',
              properties: { title: { type: 'string' }, body: { type: 'string' } },
              required: ['title', 'body'],
              additionalProperties: false,
            },
          },
        },
        required: ['key', 'kicker', 'heading', 'body', 'bullets', 'quote', 'chart', 'numberedItems', 'subTopics'],
        additionalProperties: false,
      },
    },
    publications: { type: 'array', items: { type: 'string' } },
  },
  required: ['title', 'dek', 'badge', 'coverImagePrompt', 'sections', 'publications'],
  additionalProperties: false,
} as const;

function loadSkill(): string {
  const raw = readFileSync(SKILL_PATH, 'utf8');
  return raw.replace(/^---[\s\S]*?---\s*/, '');
}

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
    bullets: s.bullets?.map(stripCitations) ?? s.bullets,
    quote: s.quote ? { ...s.quote, text: stripCitations(s.quote.text), attribution: stripCitations(s.quote.attribution) } : s.quote,
    chart: s.chart
      ? { ...s.chart, question: stripCitations(s.chart.question), source: clean(s.chart.source) }
      : s.chart,
    numberedItems: s.numberedItems?.map((n) => ({ title: stripCitations(n.title), body: stripCitations(n.body) })) ?? s.numberedItems,
    subTopics: s.subTopics?.map((t) => ({ title: stripCitations(t.title), body: stripCitations(t.body) })) ?? s.subTopics,
  }));
}

function fillTemplate(template: string, lead: Lead): string {
  return template
    .replaceAll('{title}', lead.personaTitle)
    .replaceAll('{company}', lead.organization)
    .replaceAll('{industry}', lead.industry);
}

export async function generateReport(input: GenerateInput): Promise<GeneratedReport> {
  if (!process.env.OPENAI_API_KEY) {
    return stubReport(input);
  }

  const client = new OpenAI();
  const model = MODEL_MAP[input.aiModel] ?? 'gpt-5.1';
  const { lead } = input;

  const userMessage = [
    fillTemplate(input.aiPrompt, lead),
    '',
    'Recipient / lead details:',
    `- Persona: ${lead.personaName}, ${lead.personaTitle}`,
    `- Organization: ${lead.organization} (${lead.industry})`,
    lead.orgSize ? `- Size: ${lead.orgSize}` : null,
    lead.headquarters ? `- Headquarters: ${lead.headquarters}` : null,
    lead.locationsReach ? `- Reach: ${lead.locationsReach}` : null,
    lead.hiringSignal ? `- Hiring signal: ${lead.hiringSignal}` : null,
    '',
    `Report focus: ${input.focus}`,
    `Template / tone: ${input.template}`,
    `Sections to produce (exactly these keys, in this order): ${input.sections.join(' | ')}`,
    `Sender company: ${input.companyName}`,
    `Current month for the badge: ${new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase()}`,
  ]
    .filter((l) => l !== null)
    .join('\n');

  const response = await client.responses.create({
    model,
    instructions: loadSkill(),
    input: userMessage,
    tools: [{ type: 'web_search' }],
    text: {
      format: {
        type: 'json_schema',
        name: 'industry_report',
        schema: REPORT_SCHEMA as unknown as Record<string, unknown>,
        strict: true,
      },
    },
  });

  const parsed = JSON.parse(response.output_text) as GeneratedReport & { coverImagePrompt?: string | null };

  // Cover illustration — sample-report pop-art style in HT colors.
  let coverImageUrl: string | null = null;
  if (parsed.coverImagePrompt) {
    try {
      coverImageUrl = await generateCoverImage(client, parsed.coverImagePrompt);
    } catch (err) {
      console.warn('cover image generation failed (continuing without):', err);
    }
  }

  return {
    title: stripCitations(parsed.title),
    dek: parsed.dek ? stripCitations(parsed.dek) : null,
    badge: parsed.badge ?? null,
    coverImageUrl,
    sections: sanitizeSections(parsed.sections),
    publications: (parsed.publications ?? []).map(stripCitations),
    model,
  };
}

async function generateCoverImage(client: OpenAI, prompt: string): Promise<string> {
  const fullPrompt =
    `${prompt}. Style: stylized editorial comic portrait with visible halftone dot texture, ` +
    `dramatic radial sunburst background in warm gold (#F7B84A) and deep navy (#203667), ` +
    `dark shadowed lower third suitable for overlaying a title, subject dominating the frame, ` +
    `full-bleed magazine cover composition, high contrast print aesthetic, ` +
    `absolutely no text, letters, words, or logos anywhere in the image.`;
  const result = await client.images.generate({
    model: IMAGE_MODEL,
    prompt: fullPrompt,
    size: '1024x1536',
    quality: 'medium',
    // JPEG keeps covers ~10x smaller than PNG. That matters: the image embeds
    // twice in the print PDF, and Vercel caps function responses at ~4.5MB.
    output_format: 'jpeg',
    output_compression: 80,
  });
  const b64 = result.data?.[0]?.b64_json;
  if (!b64) throw new Error('no image data returned');
  const filename = `cover-${randomUUID()}.jpg`;
  await saveImage(filename, 'image/jpeg', Buffer.from(b64, 'base64'));
  return `/api/images/${filename}`;
}

/** Deterministic stub used when OPENAI_API_KEY is not configured, so the app still demos end-to-end. */
function stubReport(input: GenerateInput): GeneratedReport {
  const { lead } = input;
  const year = new Date().getFullYear();
  const badge = `${input.companyName.toUpperCase()} · ${new Date()
    .toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    .toUpperCase()}`;
  const bodies: Record<string, ReportSection> = {
    'Industry overview': {
      key: 'Industry overview',
      heading: `${input.focus} transformation accelerates`,
      body: `${lead.industry}s enter ${year} balancing margin pressure with rising volumes. For ${lead.organization}, staffing costs and payer friction remain the biggest operational drags on ${input.focus.toLowerCase()} performance.`,
      quote: {
        text: 'We know we have to decrease cost to collect, and technology is a major play for how we can do that.',
        attribution: 'Industry revenue cycle leader',
        role: null,
      },
    },
    'Key 2026 trends': {
      key: 'Key 2026 trends',
      kicker: 'SURVEY QUESTION',
      heading: `Leaders fear their teams aren't ready for the ${input.focus.toLowerCase()} of the future`,
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
    },
    'How Honest Taskers helps': {
      key: 'How Honest Taskers helps',
      kicker: 'SUPPLEMENT',
      heading: `Treating ${input.focus.toLowerCase()} as a strategic asset, not a support function`,
      body: `${input.companyName} provides trained virtual assistants for ${input.focus.toLowerCase()} teams so ${lead.personaName.split(' ')[0]}'s staff can focus on exceptions instead of volume.`,
      numberedItems: [
        { title: 'Cover the volume work.', body: 'Eligibility, prior authorization, claim follow-up, scheduling, and patient outreach handled by trained virtual assistants.' },
        { title: 'Protect the education budget.', body: 'Free senior staff for the strategic, creative work that eases burnout and builds skills.' },
        { title: 'Scale without the ramp.', body: 'Blended virtual teams flex with volume at a fraction of onshore cost.' },
      ],
    },
  };
  return {
    title: `The ${input.focus} of the Future`,
    dek: `How ${lead.organization} can seize a rare opportunity to improve the day-to-day business operations of ${lead.industry.toLowerCase()}s.`,
    badge,
    coverImageUrl: null,
    sections: input.sections.map((s) => bodies[s]).filter(Boolean),
    publications: ['HFMA', "Becker's Hospital Review", 'RevCycle Intelligence'],
    model: 'stub (no OPENAI_API_KEY set)',
  };
}
