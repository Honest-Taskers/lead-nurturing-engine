/** Shared API shapes — mirrors app/src/data/types.ts (camelCase over the wire). */

export interface Lead {
  id: string;
  /** Owning sender (organization using the platform). */
  senderId?: string | null;
  organization: string;
  /** "Vertical" in the source spreadsheet. */
  industry: string;
  website?: string | null;
  /** logo.dev URL, derived from the website domain. */
  logoUrl?: string | null;
  /** Optional recipient headshot URL — drives the photo cover variant. */
  photoUrl?: string | null;
  headquarters?: string | null;
  orgSize?: string | null;
  locationsReach?: string | null;
  hiringSignal?: string | null;
  personaName: string;
  personaTitle: string;
  emails?: string | null;
  linkedinUrl?: string | null;
  /** LinkedIn / contact path: profile and/or company page used to reach them. */
  contactPath?: string | null;
  phone?: string | null;
  mailingAddress?: string | null;
  assignedRep: string;
  lastReportDate?: string | null; // YYYY-MM-DD
  nextDueDate?: string | null;
}

export interface ReportSection {
  key: string;
  /** Small pill label above the heading, e.g. "SURVEY QUESTION". */
  kicker?: string | null;
  heading: string;
  body: string;
  bullets?: string[] | null;
  callouts?: Array<{ title: string; body: string }> | null;
  /** Magazine pull quote. */
  quote?: { text: string; attribution: string; role?: string | null } | null;
  /** Analytical exhibit (direct-labeled bars; `highlight` marks the one conclusion datapoint). */
  chart?: {
    question: string;
    data: Array<{ label: string; value: number; suffix?: string | null; highlight?: boolean }>;
    source?: string | null;
  } | null;
  /** Big-number stat callouts rendered as a display strip ("42% · denial rate increase"). */
  stats?: Array<{ value: string; label: string; source?: string | null }> | null;
  /**
   * Numbered items. On the action agenda each carries the full
   * action / why-it-matters / first step / KPI / timing structure.
   */
  numberedItems?: Array<{
    title: string;
    body: string;
    firstStep?: string | null;
    kpi?: string | null;
    timing?: string | null;
  }> | null;
  /** Numbered key questions ("Key questions for a {role}") or square-bullet subtopics. */
  subTopics?: Array<{ title: string; body: string }> | null;
  /** Closing note only: what public/company/industry information informed the report. */
  methodology?: string | null;
}

export type ReportStatus = 'generated' | 'sent';

export interface Report {
  id: string;
  leadId: string;
  title: string;
  /** Italic subheadline under the feature title. */
  dek?: string | null;
  /** Publisher badge, e.g. "HONEST TASKERS · AUG 2026". */
  badge?: string | null;
  /** Cover photo/illustration (served from /api/images/...). */
  coverImageUrl?: string | null;
  /** Interior feature-opener photo (served from /api/images/...). */
  sectionImageUrl?: string | null;
  /** Photo attribution, e.g. "Jane Doe / Unsplash". */
  imageCredit?: string | null;
  focus: string;
  template: string;
  sections: ReportSection[];
  publications: string[];
  status: ReportStatus;
  generatedAt: string; // YYYY-MM-DD
  sentAt?: string | null;
  model?: string | null;
}

export interface AppSettings {
  companyName: string;
  defaultRep: string;
  cadenceDays: number;
  defaultSections: string[];
  aiPrompt: string;
  aiModel: string;
  logoDataUrl?: string | null;
  /** Sender brand identity — drives the report palette and closing page. */
  about?: string | null;
  brandPrimary?: string | null;
  brandSecondary?: string | null;
  fonts?: string | null;
  /** Indicator only — never the actual key. */
  apiKeyConfigured: boolean;
}

export interface Sender {
  id: string;
  name: string;
  about?: string | null;
  logoDataUrl?: string | null;
  logoUrl?: string | null;
  brandPrimary: string;
  brandSecondary: string;
  fonts?: string | null;
  defaultRep: string;
  cadenceDays: number;
  defaultSections: string[];
  aiPrompt: string;
  aiModel: string;
  isDefault: boolean;
}

export interface TeamMember {
  id: string;
  senderId: string;
  name: string;
  title?: string | null;
  email?: string | null;
  phone?: string | null;
  bio?: string | null;
  sortOrder: number;
}

/**
 * Canonical report structure. Executive summary, Actionable takeaways and
 * Closing note are mandatory (the server injects them on generate); the body
 * sections in between are the user-selectable part.
 */
export const REPORT_SECTIONS = [
  'Executive summary',
  'Industry overview',
  'Key trends & data',
  'Hiring / talent insight',
  'Top publications to follow',
  'Actionable takeaways',
  'Closing note',
] as const;

export const MANDATORY_SECTIONS = ['Executive summary', 'Actionable takeaways', 'Closing note'] as const;

export const BODY_SECTIONS = REPORT_SECTIONS.filter(
  (s) => !(MANDATORY_SECTIONS as readonly string[]).includes(s),
);

export type SectionRole = 'exec-summary' | 'body' | 'takeaways' | 'closing';

/**
 * Maps a section key to its rendering role. Legacy keys from reports already
 * in the database resolve here too, so old reports keep rendering.
 */
export function sectionRole(key: string): SectionRole {
  switch (key) {
    case 'Executive summary':
      return 'exec-summary';
    case 'Actionable takeaways':
      return 'takeaways';
    case 'Closing note':
    case 'How Honest Taskers helps': // legacy closer
      return 'closing';
    default:
      return 'body';
  }
}

/** Legacy section names → current canonical names. */
const SECTION_RENAMES: Record<string, string> = {
  'Key 2026 trends': 'Key trends & data',
  'How Honest Taskers helps': 'Closing note',
};

/**
 * Composes the final ordered section list for generation: mandatory sections
 * wrap whatever body sections were requested (legacy names normalized,
 * unknowns dropped, order preserved, deduped).
 */
export function normalizeRequestedSections(requested: string[]): string[] {
  const body: string[] = [];
  for (const raw of requested) {
    const key = SECTION_RENAMES[raw] ?? raw;
    if ((MANDATORY_SECTIONS as readonly string[]).includes(key)) continue;
    if (!(BODY_SECTIONS as readonly string[]).includes(key)) continue;
    if (!body.includes(key)) body.push(key);
  }
  return ['Executive summary', ...body, 'Actionable takeaways', 'Closing note'];
}
