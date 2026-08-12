/**
 * Idempotent demo data for dev and staging (never production).
 * Dates are relative to today so cadence states stay live.
 * Run with: npm run seed — which applies the schema first.
 */
import { randomUUID } from 'node:crypto';
import { pool } from './pool.js';
import { DEFAULT_SENDER_ID, LEADS, REPORTS, SENDERS, TEAM_MEMBERS } from './tables.js';
import { logoUrlForWebsite } from '../services/logo.js';
import { REPORT_SECTIONS, type ReportSection } from '../types.js';

/** Second demo sender so the switcher demos instantly (fixed id = idempotent). */
const DEMO_SENDER_ID = '00000000-0000-4000-8000-000000000002';

// Demo data must never land in the shared production database.
if (process.env.NODE_ENV === 'production' && process.env.ALLOW_SEED !== '1') {
  console.error('Refusing to seed: NODE_ENV=production. Set ALLOW_SEED=1 to override (staging only).');
  process.exit(1);
}

const pad = (n: number) => String(n).padStart(2, '0');
function iso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function rel(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return iso(d);
}
function monthWeekLabel(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00');
  const mon = d.toLocaleDateString('en-US', { month: 'short' });
  return `${mon} wk${Math.min(4, Math.ceil(d.getDate() / 7))}`;
}

interface Seed {
  organization: string;
  industry: string;
  personaName: string;
  personaTitle: string;
  hq: string;
  size: string;
  due: number | null; // days from today; null = never sent
}

/**
 * Real domains for the well-known systems so logo.dev actually resolves a logo
 * in the demo data. The fictional practices fall back to a synthetic domain.
 */
const DOMAINS: Record<string, string> = {
  'CommonSpirit Health': 'commonspirit.org',
  Ascension: 'ascension.org',
  'Tenet Healthcare': 'tenethealth.com',
  'HCA Healthcare': 'hcahealthcare.com',
  Providence: 'providence.org',
  'Trinity Health': 'trinity-health.org',
  'Advocate Health': 'advocatehealth.org',
  'Intermountain Health': 'intermountainhealthcare.org',
  'Banner Health': 'bannerhealth.com',
  'Sutter Health': 'sutterhealth.org',
  'Mass General Brigham': 'massgeneralbrigham.org',
  'Northwell Health': 'northwell.edu',
  'Cleveland Clinic': 'clevelandclinic.org',
  'Mayo Clinic': 'mayoclinic.org',
  'Kaiser Permanente': 'kp.org',
  Geisinger: 'geisinger.org',
  'Ochsner Health': 'ochsner.org',
  'Baylor Scott & White': 'bswhealth.com',
  'Corewell Health': 'corewellhealth.org',
  UPMC: 'upmc.com',
  'Summit Orthopedics': 'summitortho.com',
};

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

function seedSections(lead: Seed, focus: string): ReportSection[] {
  return [
    {
      key: REPORT_SECTIONS[0],
      heading: 'Industry overview',
      body: `${lead.industry}s continue to face margin pressure in 2026 as labor costs, payer friction, and denial rates stay elevated. Organizations at ${lead.size.split(';')[0].toLowerCase()} scale are prioritizing operational efficiency in ${focus.toLowerCase()} to protect cash flow.`,
    },
    {
      key: REPORT_SECTIONS[1],
      heading: `Key 2026 trends in ${focus.toLowerCase()}`,
      body: 'Automation of eligibility, prior authorization, and claim status checks is the dominant investment theme, with staffing models shifting toward blended onshore/virtual teams.',
      callouts: [
        { title: 'Automation & AI in RCM', body: 'AI-assisted coding and denial triage are moving from pilots to production across leading systems.' },
        { title: 'Staffing & VMA leverage', body: 'Virtual medical assistants now cover eligibility, scheduling, and follow-up at 40-60% of onshore cost.' },
      ],
    },
    {
      key: REPORT_SECTIONS[2],
      heading: 'Top publications to follow',
      body: 'HFMA · Becker\'s Hospital Review · RevCycle Intelligence',
    },
    {
      key: REPORT_SECTIONS[4],
      heading: 'How Honest Taskers helps',
      body: `Honest Taskers provides trained virtual assistants for ${focus.toLowerCase()} teams — eligibility, prior auth, claim follow-up, and patient outreach — so leaders like ${lead.personaName.split(' ')[0]}'s team can focus on exceptions, not volume.`,
    },
  ];
}

async function main() {
  // Schema, migrations, the settings singleton and the default sender are
  // handled by scripts/apply-schema.mjs, which `npm run seed` runs first.

  // 1. Sender branding + team (meeting 08/11: Diana, Christine, Hina)
  await pool.query(
    `UPDATE ${SENDERS} SET about = COALESCE(about, ?), brand_primary = '#203667', brand_secondary = '#F7B84A' WHERE id = ?`,
    [
      'Honest Taskers builds trained remote healthcare staffing teams — front desk, billing, eligibility and patient outreach — for clinics and health systems across the US.',
      DEFAULT_SENDER_ID,
    ],
  );
  const team = [
    { id: '00000000-0000-4000-8000-000000001001', name: 'Diana', title: 'Client Partnerships', sort: 0 },
    { id: '00000000-0000-4000-8000-000000001002', name: 'Christine', title: 'Client Partnerships', sort: 1 },
    { id: '00000000-0000-4000-8000-000000001003', name: 'Hina', title: 'Client Partnerships', sort: 2 },
  ];
  for (const m of team) {
    await pool.query(
      `INSERT IGNORE INTO ${TEAM_MEMBERS} (id, sender_id, name, title, sort_order) VALUES (?, ?, ?, ?, ?)`,
      [m.id, DEFAULT_SENDER_ID, m.name, m.title, m.sort],
    );
  }
  // Financial-advisory rehearsal tenant (Wednesday tester demo): custom
  // sections named for an advisory practice, prospect leads below.
  const sterlingSections = [
    'Where the wealth landscape is moving',
    'Tax & entity considerations',
    'Succession & exit readiness',
  ];
  await pool.query(
    `INSERT IGNORE INTO ${SENDERS} (id, name, about, brand_primary, brand_secondary, default_rep, cadence_days, default_sections, ai_prompt, ai_model, is_default)
     VALUES (?, 'Sterling Financial Partners', 'Independent wealth advisory serving founders and family offices.', '#0F3D2E', '#C9A227', 'Morgan', 14, ?, ?, 'claude-sonnet-5', 0)`,
    [
      DEMO_SENDER_ID,
      JSON.stringify(sterlingSections),
      'Write a concise, executive briefing for {title} at {company} in {industry}. Cite real trends & publications. Warm, credible, non-salesy.',
    ],
  );
  // Upgrade an already-seeded Sterling row in place (INSERT IGNORE skips it).
  await pool.query(
    `UPDATE ${SENDERS} SET ai_model = 'claude-sonnet-5', default_sections = ? WHERE id = ? AND ai_model = 'gpt-5.1'`,
    [JSON.stringify(sterlingSections), DEMO_SENDER_ID],
  );
  await pool.query(
    `INSERT IGNORE INTO ${TEAM_MEMBERS} (id, sender_id, name, title, sort_order) VALUES (?, ?, 'Morgan Sterling', 'Managing Partner, CFP', 0)`,
    ['00000000-0000-4000-8000-000000002001', DEMO_SENDER_ID],
  );

  // Financial-advisory prospect leads for rehearsal — public companies/orgs
  // so the research agent has real material to work with.
  const sterlingLeads = [
    {
      organization: "Portillo's",
      industry: 'Restaurant group',
      website: 'portillos.com',
      hq: 'Chicago, IL',
      size: 'Mid-cap; ~10,000 employees',
      reach: '90+ locations across 10 states',
      signal: 'Founder-era brand navigating post-IPO ownership transitions',
      personaName: 'Michael Osanloo',
      personaTitle: 'Chief Executive Officer',
    },
    {
      organization: 'Duckhorn Portfolio',
      industry: 'Wine & beverage',
      website: 'duckhorn.com',
      hq: 'St. Helena, CA',
      size: 'Mid-market; ~500 employees',
      reach: '11 wineries across California and Washington',
      signal: 'Recently taken private — ownership and equity structures in motion',
      personaName: 'Robert Hanson',
      personaTitle: 'President & Chief Executive Officer',
    },
    {
      organization: 'Graham Holdings',
      industry: 'Diversified holding company',
      website: 'ghco.com',
      hq: 'Arlington, VA',
      size: 'Enterprise; 20,000+ employees',
      reach: 'Education, media, healthcare and manufacturing units',
      signal: 'Active acquirer of founder-led businesses; succession planning relevance',
      personaName: "Timothy O'Shaughnessy",
      personaTitle: 'Chief Executive Officer',
    },
  ];
  for (const l of sterlingLeads) {
    const [dupes] = await pool.query<import('mysql2/promise').RowDataPacket[]>(
      `SELECT id FROM ${LEADS} WHERE organization = ? AND persona_name = ?`,
      [l.organization, l.personaName],
    );
    if (dupes.length) continue;
    await pool.query(
      `INSERT INTO ${LEADS} (id, sender_id, organization, industry, website, logo_url, headquarters, org_size, locations_reach,
                          hiring_signal, persona_name, persona_title, assigned_rep)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Morgan')
       ON DUPLICATE KEY UPDATE organization = organization`,
      [
        randomUUID(),
        DEMO_SENDER_ID,
        l.organization,
        l.industry,
        l.website,
        logoUrlForWebsite(l.website),
        l.hq,
        l.size,
        l.reach,
        l.signal,
        l.personaName,
        l.personaTitle,
      ],
    );
  }
  console.log('senders + team ok');

  // 2. Leads + historical reports
  let leadsInserted = 0;
  let leadsRefreshed = 0;
  let reportsInserted = 0;
  for (const s of seeds) {
    const sent = s.due !== null;
    const nextDue = sent ? rel(s.due!) : null;
    const lastReport = sent ? rel(s.due! - 14) : null;
    const [first, ...rest] = s.personaName.split(' ');
    const domain = DOMAINS[s.organization] ?? `${slug(s.organization).replace(/-/g, '')}.org`;
    const leadId = randomUUID();

    const contactPath = `https://www.linkedin.com/company/${slug(s.organization)}/`;

    const [dupes] = await pool.query<import('mysql2/promise').RowDataPacket[]>(
      `SELECT id FROM ${LEADS} WHERE organization = ? AND persona_name = ?`,
      [s.organization, s.personaName],
    );
    if (dupes.length) {
      // Already seeded: refresh the fields added since, keeping report history.
      await pool.query(
        `UPDATE ${LEADS} SET website = ?, logo_url = ?, contact_path = ? WHERE id = ?`,
        [domain, logoUrlForWebsite(domain), contactPath, dupes[0].id],
      );
      leadsRefreshed += 1;
      continue;
    }

    await pool.query(
      `INSERT INTO ${LEADS} (id, sender_id, organization, industry, website, logo_url, headquarters, org_size, locations_reach,
                          hiring_signal, persona_name, persona_title, emails, linkedin_url, contact_path,
                          mailing_address, assigned_rep, last_report_date, next_due_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE organization = organization`,
      [
        leadId,
        DEFAULT_SENDER_ID,
        s.organization,
        s.industry,
        domain,
        logoUrlForWebsite(domain),
        s.hq,
        s.size,
        s.size.startsWith('Enterprise') ? '100+ facilities; multi-state' : null,
        seeds.indexOf(s) % 3 === 0 ? 'Ongoing enterprise healthcare hiring' : seeds.indexOf(s) % 3 === 1 ? 'Open RCM analyst roles' : null,
        s.personaName,
        s.personaTitle,
        `${first.toLowerCase()}.${rest.join('').toLowerCase()}@${domain}`,
        `linkedin.com/in/${slug(s.personaName)}`,
        contactPath,
        s.hq,
        'Jaya',
        lastReport,
        nextDue,
      ],
    );
    leadsInserted += 1;

    if (sent) {
      const focus = s.personaTitle.toLowerCase().includes('patient access')
        ? 'Patient access'
        : s.personaTitle.toLowerCase().includes('finance')
          ? 'Healthcare finance'
          : 'Revenue cycle management';
      const topic = focus === 'Revenue cycle management' ? 'Revenue Cycle Trends' : `${focus} Trends`;
      for (const d of [lastReport!, rel(s.due! - 28)]) {
        await pool.query(
          `INSERT INTO ${REPORTS} (id, lead_id, title, focus, template, sections, publications, status, generated_at, sent_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'sent', ?, ?)`,
          [
            randomUUID(),
            leadId,
            `${topic} — ${monthWeekLabel(d)}`,
            focus,
            'Executive brief · confident, helpful',
            JSON.stringify(seedSections(s, focus)),
            JSON.stringify(['HFMA', "Becker's Hospital Review", 'RevCycle Intelligence']),
            d,
            d,
          ],
        );
        reportsInserted += 1;
      }
    }
  }
  console.log(
    `leads inserted: ${leadsInserted}, refreshed: ${leadsRefreshed}, reports inserted: ${reportsInserted}`,
  );

  const [[leadCount]] = await pool.query<import('mysql2/promise').RowDataPacket[]>(`SELECT COUNT(*) AS c FROM ${LEADS}`);
  const [[reportCount]] = await pool.query<import('mysql2/promise').RowDataPacket[]>(`SELECT COUNT(*) AS c FROM ${REPORTS}`);
  console.log(`totals — leads: ${leadCount.c}, reports: ${reportCount.c}`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
