/** Shared API shapes — mirrors app/src/data/types.ts (camelCase over the wire). */

export interface Lead {
  id: string;
  organization: string;
  /** "Vertical" in the source spreadsheet. */
  industry: string;
  website?: string | null;
  /** logo.dev URL, derived from the website domain. */
  logoUrl?: string | null;
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
  /** Horizontal bar chart in the sample report's survey style. */
  chart?: {
    question: string;
    data: Array<{ label: string; value: number; suffix?: string | null }>;
    source?: string | null;
  } | null;
  /** Big-numeral lessons ("1 Don't jump to tech first."). */
  numberedItems?: Array<{ title: string; body: string }> | null;
  /** Square-bullet subtopics ("■ Uncertain payer relations."). */
  subTopics?: Array<{ title: string; body: string }> | null;
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
  /** Generated cover illustration (served from /api/images/...). */
  coverImageUrl?: string | null;
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
  /** Indicator only — never the actual key. */
  apiKeyConfigured: boolean;
}

export const REPORT_SECTIONS = [
  'Industry overview',
  'Key 2026 trends',
  'Top publications to follow',
  'Hiring / talent insight',
  'How Honest Taskers helps',
] as const;
