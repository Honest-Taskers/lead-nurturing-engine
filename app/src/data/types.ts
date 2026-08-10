/** Mirrors the future MySQL schema (leads, reports, settings tables). */

export interface Lead {
  id: string;
  // Organization
  organization: string;
  /** "Vertical" in the source spreadsheet. */
  industry: string;
  website?: string;
  /** logo.dev URL, derived server-side from the website domain. */
  logoUrl?: string | null;
  headquarters?: string;
  orgSize?: string;
  locationsReach?: string;
  hiringSignal?: string;
  // Target persona (drives personalization) — one lead row per person
  personaName: string;
  personaTitle: string;
  emails?: string;
  linkedinUrl?: string;
  /** LinkedIn / contact path: profile and/or company page used to reach them. */
  contactPath?: string | null;
  phone?: string;
  mailingAddress?: string;
  assignedRep: string;
  // Cadence state
  lastReportDate?: string; // ISO date
  nextDueDate?: string; // ISO date; undefined together with lastReportDate => never sent
}

export type ReportStatus = 'generated' | 'sent';

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

export interface Report {
  id: string;
  leadId: string;
  title: string;
  dek?: string | null;
  badge?: string | null;
  coverImageUrl?: string | null;
  focus: string;
  template: string;
  sections: ReportSection[];
  publications: string[];
  generatedAt: string; // ISO date
  sentAt?: string | null;
  status: ReportStatus;
  model?: string | null;
}

export interface AppSettings {
  companyName: string;
  defaultRep: string;
  cadenceDays: number;
  defaultSections: string[];
  aiPrompt: string;
  aiModel: string;
  /** Server-side indicator — the key itself never leaves the server. */
  apiKeyConfigured: boolean;
  logoDataUrl?: string | null;
}

export const REPORT_SECTIONS = [
  'Industry overview',
  'Key 2026 trends',
  'Top publications to follow',
  'Hiring / talent insight',
  'How Honest Taskers helps',
] as const;

export const REPORT_TEMPLATES = [
  'Executive brief · confident, helpful',
  'Deep dive · analytical, thorough',
  'Quick pulse · short, scannable',
] as const;

/** Derived due status for chips and filtering. */
export type DueStatus =
  | { kind: 'never' }
  | { kind: 'today' }
  | { kind: 'overdue'; days: number }
  | { kind: 'soon'; days: number } // within 7 days
  | { kind: 'scheduled'; date: string };

export function getDueStatus(lead: Lead, today = new Date()): DueStatus {
  if (!lead.nextDueDate) return { kind: 'never' };
  const due = new Date(lead.nextDueDate + 'T00:00:00');
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffDays = Math.round((due.getTime() - t0.getTime()) / 86_400_000);
  if (diffDays < 0) return { kind: 'overdue', days: -diffDays };
  if (diffDays === 0) return { kind: 'today' };
  if (diffDays <= 7) return { kind: 'soon', days: diffDays };
  return { kind: 'scheduled', date: lead.nextDueDate };
}

export function isDue(lead: Lead, today = new Date()): boolean {
  const s = getDueStatus(lead, today);
  return s.kind === 'never' || s.kind === 'today' || s.kind === 'overdue' || s.kind === 'soon';
}

export function formatShortDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
