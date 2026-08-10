/**
 * Idempotent schema + seed for the Railway MySQL instance.
 * Ports the phase-1 mock data; dates are relative to today so cadence states stay live.
 * Run with: npm run seed
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { pool } from './pool.js';
import { LEADS, REPORTS, SETTINGS } from './tables.js';
import { REPORT_SECTIONS, type ReportSection } from '../types.js';

// Demo data must never land in the shared production database.
if (process.env.NODE_ENV === 'production' && process.env.ALLOW_SEED !== '1') {
  console.error('Refusing to seed: NODE_ENV=production. Set ALLOW_SEED=1 to override (staging only).');
  process.exit(1);
}

const here = path.dirname(fileURLToPath(import.meta.url));

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
  // 1. Schema — schema.sql sits next to this file in src/, but tsc does not
  // copy .sql files to dist/, so fall back to the source location.
  const schemaPath = [path.join(here, 'schema.sql'), path.join(here, '../../src/db/schema.sql')].find((p) => {
    try { readFileSync(p); return true; } catch { return false; }
  });
  if (!schemaPath) throw new Error('schema.sql not found');
  const schema = readFileSync(schemaPath, 'utf8');
  for (const stmt of schema.split(/;\s*(?:\r?\n|$)/).filter((s) => s.trim())) {
    await pool.query(stmt);
  }
  console.log('schema ok');

  // Migration: editorial columns added in phase "report generation lock-in" (MySQL 8 has no ADD COLUMN IF NOT EXISTS)
  const [cols] = await pool.query<import('mysql2/promise').RowDataPacket[]>(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${REPORTS}'`,
  );
  const existing = new Set(cols.map((c) => c.COLUMN_NAME as string));
  if (!existing.has('dek')) await pool.query(`ALTER TABLE ${REPORTS} ADD COLUMN dek VARCHAR(500) NULL AFTER title`);
  if (!existing.has('badge')) await pool.query(`ALTER TABLE ${REPORTS} ADD COLUMN badge VARCHAR(120) NULL AFTER dek`);
  if (!existing.has('cover_image_url'))
    await pool.query(`ALTER TABLE ${REPORTS} ADD COLUMN cover_image_url VARCHAR(255) NULL AFTER badge`);
  // Report generation moved to OpenAI — migrate any legacy model selection
  await pool.query(`UPDATE ${SETTINGS} SET ai_model = 'gpt-5.1' WHERE ai_model LIKE '%laude%'`);
  console.log('migrations ok');

  // 2. Settings singleton
  await pool.query(
    `INSERT INTO ${SETTINGS} (id, company_name, default_rep, cadence_days, default_sections, ai_prompt, ai_model)
     VALUES (1, 'Honest Taskers', 'Jaya', 14, ?, ?, 'gpt-5.1')
     ON DUPLICATE KEY UPDATE id = id`,
    [
      JSON.stringify(REPORT_SECTIONS),
      'Write a concise, executive industry brief for {title} at {company} in {industry}. Cite real trends & publications. Warm, credible, non-salesy.',
    ],
  );
  console.log('settings ok');

  // 3. Leads + historical reports
  let leadsInserted = 0;
  let reportsInserted = 0;
  for (const s of seeds) {
    const sent = s.due !== null;
    const nextDue = sent ? rel(s.due!) : null;
    const lastReport = sent ? rel(s.due! - 14) : null;
    const [first, ...rest] = s.personaName.split(' ');
    const domain = slug(s.organization).replace(/-/g, '') + '.org';
    const leadId = randomUUID();

    const [dupes] = await pool.query<import('mysql2/promise').RowDataPacket[]>(
      `SELECT id FROM ${LEADS} WHERE organization = ? AND persona_name = ?`,
      [s.organization, s.personaName],
    );
    if (dupes.length) continue; // already seeded — keep idempotent

    await pool.query(
      `INSERT INTO ${LEADS} (id, organization, industry, website, headquarters, org_size, locations_reach,
                          hiring_signal, persona_name, persona_title, emails, linkedin_url,
                          mailing_address, assigned_rep, last_report_date, next_due_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE organization = organization`,
      [
        leadId,
        s.organization,
        s.industry,
        domain,
        s.hq,
        s.size,
        s.size.startsWith('Enterprise') ? '100+ facilities; multi-state' : null,
        seeds.indexOf(s) % 3 === 0 ? 'Ongoing enterprise healthcare hiring' : seeds.indexOf(s) % 3 === 1 ? 'Open RCM analyst roles' : null,
        s.personaName,
        s.personaTitle,
        `${first.toLowerCase()}.${rest.join('').toLowerCase()}@${domain}`,
        `linkedin.com/in/${slug(s.personaName)}`,
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
  console.log(`leads inserted: ${leadsInserted}, reports inserted: ${reportsInserted}`);

  const [[leadCount]] = await pool.query<import('mysql2/promise').RowDataPacket[]>(`SELECT COUNT(*) AS c FROM ${LEADS}`);
  const [[reportCount]] = await pool.query<import('mysql2/promise').RowDataPacket[]>(`SELECT COUNT(*) AS c FROM ${REPORTS}`);
  console.log(`totals — leads: ${leadCount.c}, reports: ${reportCount.c}`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
