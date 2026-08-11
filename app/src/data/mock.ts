/**
 * BACKUP DATA — no longer used by the running app (data now comes from the API).
 * Kept because the Railway MySQL instance is temporary: to restore a fresh database,
 * run `npm run seed` in server/ (canonical restore path, same data as below).
 */
import type { AppSettings, Lead, Report } from './types';
import { BODY_SECTIONS, REPORT_SECTIONS, addDays, todayIso } from './types';

/** Dates are seeded relative to "today" so the demo always shows live cadence states. */
const today = todayIso();
const rel = (days: number) => addDays(today, days);

interface Seed {
  organization: string;
  industry: string;
  personaName: string;
  personaTitle: string;
  hq: string;
  size: string;
  /** next due offset in days from today; null = never sent */
  due: number | null;
  rep?: string;
}

const seeds: Seed[] = [
  { organization: 'CommonSpirit Health', industry: 'Hospital System', personaName: 'Steve Scharmann', personaTitle: 'VP of Revenue Cycle', hq: 'Chicago, IL', size: 'Enterprise; 150,000+', due: 0 },
  { organization: 'Ascension', industry: 'Hospital System', personaName: 'James Logsdon', personaTitle: 'RCM Leader', hq: 'St. Louis, MO', size: 'Enterprise; 134,000+', due: 2 },
  { organization: 'Tenet Healthcare', industry: 'Hospital System', personaName: 'Dana Whitfield', personaTitle: 'Director of Revenue Cycle', hq: 'Dallas, TX', size: 'Enterprise; 110,000+', due: null },
  { organization: 'HCA Healthcare', industry: 'Hospital System', personaName: 'Priya Raman', personaTitle: 'VP Patient Access', hq: 'Nashville, TN', size: 'Enterprise; 250,000+', due: 13 },
  { organization: 'Providence', industry: 'Hospital System', personaName: 'Miguel Santos', personaTitle: 'SVP Finance', hq: 'Renton, WA', size: 'Enterprise; 120,000+', due: 15 },
  { organization: 'Trinity Health', industry: 'Hospital System', personaName: 'Rachel Kim', personaTitle: 'RCM Director', hq: 'Livonia, MI', size: 'Enterprise; 123,000+', due: null },
  { organization: 'Advocate Health', industry: 'Hospital System', personaName: 'Tom Berger', personaTitle: 'VP Revenue Integrity', hq: 'Charlotte, NC', size: 'Enterprise; 155,000+', due: 1 },
  { organization: 'Intermountain Health', industry: 'Hospital System', personaName: 'Alicia Moreno', personaTitle: 'Chief Revenue Officer', hq: 'Salt Lake City, UT', size: 'Large; 68,000+', due: 4 },
  { organization: 'Banner Health', industry: 'Hospital System', personaName: 'Kevin Doyle', personaTitle: 'Director, Patient Financial Services', hq: 'Phoenix, AZ', size: 'Large; 55,000+', due: 6 },
  { organization: 'Sutter Health', industry: 'Hospital System', personaName: 'Grace Lin', personaTitle: 'VP Revenue Cycle Operations', hq: 'Sacramento, CA', size: 'Large; 57,000+', due: 9 },
  { organization: 'Mass General Brigham', industry: 'Hospital System', personaName: 'Sean Callahan', personaTitle: 'Executive Director, RCM', hq: 'Boston, MA', size: 'Enterprise; 82,000+', due: 11 },
  { organization: 'Northwell Health', industry: 'Hospital System', personaName: 'Fatima Idris', personaTitle: 'AVP Revenue Cycle', hq: 'New Hyde Park, NY', size: 'Enterprise; 85,000+', due: -1 },
  { organization: 'Cleveland Clinic', industry: 'Hospital System', personaName: 'Robert Vance', personaTitle: 'Senior Director, Patient Access', hq: 'Cleveland, OH', size: 'Enterprise; 77,000+', due: 18 },
  { organization: 'Mayo Clinic', industry: 'Hospital System', personaName: 'Hannah Ostrem', personaTitle: 'VP Finance Operations', hq: 'Rochester, MN', size: 'Enterprise; 76,000+', due: 21 },
  { organization: 'Kaiser Permanente', industry: 'Health Plan & System', personaName: 'Derek Waters', personaTitle: 'Director, Claims Operations', hq: 'Oakland, CA', size: 'Enterprise; 300,000+', due: null },
  { organization: 'Geisinger', industry: 'Hospital System', personaName: 'Monica Alvarez', personaTitle: 'VP Revenue Cycle', hq: 'Danville, PA', size: 'Large; 26,000+', due: 3 },
  { organization: 'Ochsner Health', industry: 'Hospital System', personaName: 'Leo Fontenot', personaTitle: 'RCM Director', hq: 'New Orleans, LA', size: 'Large; 36,000+', due: 5 },
  { organization: 'Baylor Scott & White', industry: 'Hospital System', personaName: 'Emily Tran', personaTitle: 'VP Patient Financial Services', hq: 'Dallas, TX', size: 'Large; 49,000+', due: 8 },
  { organization: 'Corewell Health', industry: 'Hospital System', personaName: 'Jason Pruitt', personaTitle: 'Director of Revenue Cycle', hq: 'Grand Rapids, MI', size: 'Large; 60,000+', due: null },
  { organization: 'UPMC', industry: 'Hospital System', personaName: 'Sara Novak', personaTitle: 'AVP Revenue Cycle Systems', hq: 'Pittsburgh, PA', size: 'Enterprise; 95,000+', due: 12 },
  { organization: 'Smile Design Dental', industry: 'Dental Group', personaName: 'Carlos Vega', personaTitle: 'Practice Owner', hq: 'Miami, FL', size: 'SMB; 45', due: 0 },
  { organization: 'BrightPath Behavioral', industry: 'Behavioral Health', personaName: 'Naomi Fischer', personaTitle: 'Clinical Director', hq: 'Austin, TX', size: 'SMB; 120', due: 2 },
  { organization: 'Lakeside Family Medicine', industry: 'Primary Care Group', personaName: 'Owen Marsh', personaTitle: 'Managing Physician', hq: 'Madison, WI', size: 'SMB; 60', due: null },
  { organization: 'Summit Orthopedics', industry: 'Specialty Group', personaName: 'Iris Chandler', personaTitle: 'COO', hq: 'Denver, CO', size: 'Mid; 340', due: 7 },
  { organization: 'Harbor Point Pediatrics', industry: 'Primary Care Group', personaName: 'Ben Okafor', personaTitle: 'Practice Administrator', hq: 'Baltimore, MD', size: 'SMB; 85', due: 16 },
];

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export const mockLeads: Lead[] = seeds.map((s, i) => {
  const [first, ...rest] = s.personaName.split(' ');
  const last = rest.join('');
  const domain = slug(s.organization).replace(/-/g, '') + '.org';
  const sent = s.due !== null;
  return {
    id: `lead-${i + 1}`,
    organization: s.organization,
    industry: s.industry,
    website: domain,
    headquarters: s.hq,
    orgSize: s.size,
    locationsReach: s.size.startsWith('Enterprise') ? '100+ facilities; multi-state' : undefined,
    hiringSignal: i % 3 === 0 ? 'Ongoing enterprise healthcare hiring' : i % 3 === 1 ? 'Open RCM analyst roles' : undefined,
    personaName: s.personaName,
    personaTitle: s.personaTitle,
    emails: `${first.toLowerCase()}.${last.toLowerCase()}@${domain}`,
    linkedinUrl: `linkedin.com/in/${slug(s.personaName)}`,
    phone: undefined,
    mailingAddress: s.hq,
    assignedRep: s.rep ?? 'Jaya',
    lastReportDate: sent ? addDays(rel(s.due!), -14) : undefined,
    nextDueDate: sent ? rel(s.due!) : undefined,
  };
});

function monthWeekLabel(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  const mon = d.toLocaleDateString('en-US', { month: 'short' });
  const wk = Math.min(4, Math.ceil(d.getDate() / 7));
  return `${mon} wk${wk}`;
}

export const mockReports: Report[] = mockLeads
  .filter((l) => l.lastReportDate)
  .flatMap((l) => {
    const focus = l.personaTitle.toLowerCase().includes('patient access')
      ? 'Patient access'
      : l.personaTitle.toLowerCase().includes('finance')
        ? 'Healthcare finance'
        : 'Revenue cycle management';
    const topic = focus === 'Revenue cycle management' ? 'Revenue Cycle Trends' : `${focus} Trends`;
    const d1 = l.lastReportDate!;
    const d0 = addDays(d1, -14);
    const sections = REPORT_SECTIONS.map((s) => ({ key: s, heading: s, body: '' }));
    return [
      {
        id: `rpt-${l.id}-2`,
        leadId: l.id,
        title: `${topic} — ${monthWeekLabel(d1)}`,
        focus,
        template: 'Executive brief · confident, helpful',
        sections,
        publications: [],
        generatedAt: d1,
        status: 'sent' as const,
      },
      {
        id: `rpt-${l.id}-1`,
        leadId: l.id,
        title: `${topic} — ${monthWeekLabel(d0)}`,
        focus,
        template: 'Executive brief · confident, helpful',
        sections,
        publications: [],
        generatedAt: d0,
        status: 'sent' as const,
      },
    ];
  });

export const defaultSettings: AppSettings = {
  companyName: 'Honest Taskers',
  defaultRep: 'Jaya',
  cadenceDays: 14,
  // Body sections only — the mandatory structure is injected server-side.
  defaultSections: [...BODY_SECTIONS],
  aiPrompt:
    'Write a concise, executive industry brief for {title} at {company} in {industry}. Cite real trends & publications. Warm, credible, non-salesy.',
  aiModel: 'gpt-5.1',
  apiKeyConfigured: false,
};
