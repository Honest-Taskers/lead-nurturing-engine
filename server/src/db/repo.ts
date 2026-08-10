import { randomUUID } from 'node:crypto';
import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { pool } from './pool.js';
import { LEADS, REPORTS, SETTINGS } from './tables.js';
import { logoUrlForWebsite, withLogoToken } from '../services/logo.js';
import type { AppSettings, Lead, Report, ReportSection } from '../types.js';

/**
 * Fills in the logo.dev URL from the website domain unless one was supplied,
 * so imported and hand-entered leads both get a logo without extra work.
 */
function withDerivedLogo(input: Partial<Lead>): Partial<Lead> {
  if (input.logoUrl || !input.website) return input;
  const logoUrl = logoUrlForWebsite(input.website);
  return logoUrl ? { ...input, logoUrl } : input;
}

/* ---------- row mapping ---------- */

function rowToLead(r: RowDataPacket): Lead {
  return {
    id: r.id,
    organization: r.organization,
    industry: r.industry,
    website: r.website,
    logoUrl: withLogoToken(r.logo_url),
    headquarters: r.headquarters,
    orgSize: r.org_size,
    locationsReach: r.locations_reach,
    hiringSignal: r.hiring_signal,
    personaName: r.persona_name,
    personaTitle: r.persona_title,
    emails: r.emails,
    linkedinUrl: r.linkedin_url,
    contactPath: r.contact_path,
    phone: r.phone,
    mailingAddress: r.mailing_address,
    assignedRep: r.assigned_rep,
    lastReportDate: r.last_report_date,
    nextDueDate: r.next_due_date,
  };
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

function rowToReport(r: RowDataPacket): Report {
  return {
    id: r.id,
    leadId: r.lead_id,
    title: r.title,
    dek: r.dek,
    badge: r.badge,
    coverImageUrl: r.cover_image_url,
    focus: r.focus,
    template: r.template,
    sections: parseJson<ReportSection[]>(r.sections, []),
    publications: parseJson<string[]>(r.publications, []),
    status: r.status,
    generatedAt: r.generated_at,
    sentAt: r.sent_at,
    model: r.model,
  };
}

/* ---------- leads ---------- */

const LEAD_COLUMNS: Record<string, keyof Lead> = {
  organization: 'organization',
  industry: 'industry',
  website: 'website',
  logo_url: 'logoUrl',
  headquarters: 'headquarters',
  org_size: 'orgSize',
  locations_reach: 'locationsReach',
  hiring_signal: 'hiringSignal',
  persona_name: 'personaName',
  persona_title: 'personaTitle',
  emails: 'emails',
  linkedin_url: 'linkedinUrl',
  contact_path: 'contactPath',
  phone: 'phone',
  mailing_address: 'mailingAddress',
  assigned_rep: 'assignedRep',
  last_report_date: 'lastReportDate',
  next_due_date: 'nextDueDate',
};

export async function listLeads(): Promise<Lead[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM ${LEADS} ORDER BY created_at DESC, organization`,
  );
  return rows.map(rowToLead);
}

export async function getLead(id: string): Promise<Lead | null> {
  const [rows] = await pool.query<RowDataPacket[]>(`SELECT * FROM ${LEADS} WHERE id = ?`, [id]);
  return rows[0] ? rowToLead(rows[0]) : null;
}

export async function createLead(input: Partial<Lead>): Promise<Lead> {
  const lead = withDerivedLogo(input);
  const id = lead.id ?? randomUUID();
  const cols = ['id'];
  const values: unknown[] = [id];
  for (const [col, key] of Object.entries(LEAD_COLUMNS)) {
    cols.push(col);
    values.push(lead[key] ?? null);
  }
  await pool.query(
    `INSERT INTO ${LEADS} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`,
    values,
  );
  return (await getLead(id))!;
}

export async function updateLead(id: string, input: Partial<Lead>): Promise<Lead | null> {
  // A changed website re-derives the logo, unless the caller set one explicitly.
  const lead = 'website' in input && !('logoUrl' in input) ? withDerivedLogo(input) : input;
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [col, key] of Object.entries(LEAD_COLUMNS)) {
    if (key in lead) {
      sets.push(`${col} = ?`);
      values.push(lead[key] ?? null);
    }
  }
  if (sets.length) {
    values.push(id);
    await pool.query(`UPDATE ${LEADS} SET ${sets.join(', ')} WHERE id = ?`, values);
  }
  return getLead(id);
}

/** Import with dedupe on (organization, persona_name). */
export async function importLeads(
  rows: Array<Partial<Lead>>,
  defaultRep: string,
): Promise<{ imported: number; skipped: number }> {
  let imported = 0;
  let skipped = 0;
  for (const row of rows) {
    if (!row.organization) {
      skipped += 1;
      continue;
    }
    try {
      await createLead({
        industry: '',
        personaName: '',
        personaTitle: '',
        assignedRep: defaultRep,
        ...row,
      });
      imported += 1;
    } catch (err: unknown) {
      if ((err as { code?: string }).code === 'ER_DUP_ENTRY') skipped += 1;
      else throw err;
    }
  }
  return { imported, skipped };
}

/* ---------- reports ---------- */

export async function listReportsForLead(leadId: string): Promise<Report[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM ${REPORTS} WHERE lead_id = ? ORDER BY generated_at DESC, created_at DESC`,
    [leadId],
  );
  return rows.map(rowToReport);
}

export async function getReport(id: string): Promise<Report | null> {
  const [rows] = await pool.query<RowDataPacket[]>(`SELECT * FROM ${REPORTS} WHERE id = ?`, [id]);
  return rows[0] ? rowToReport(rows[0]) : null;
}

export async function createReport(report: Omit<Report, 'id'> & { id?: string }): Promise<Report> {
  const id = report.id ?? randomUUID();
  await pool.query(
    `INSERT INTO ${REPORTS} (id, lead_id, title, dek, badge, cover_image_url, focus, template, sections, publications, status, generated_at, sent_at, model)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      report.leadId,
      report.title,
      report.dek ?? null,
      report.badge ?? null,
      report.coverImageUrl ?? null,
      report.focus,
      report.template,
      JSON.stringify(report.sections),
      JSON.stringify(report.publications ?? []),
      report.status,
      report.generatedAt,
      report.sentAt ?? null,
      report.model ?? null,
    ],
  );
  return (await getReport(id))!;
}

export async function markReportSent(id: string, cadenceDays: number): Promise<Report | null> {
  const report = await getReport(id);
  if (!report) return null;
  const today = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const todayIso = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  await pool.query(`UPDATE ${REPORTS} SET status = 'sent', sent_at = ? WHERE id = ?`, [todayIso, id]);
  await pool.query(
    `UPDATE ${LEADS} SET last_report_date = ?, next_due_date = DATE_ADD(?, INTERVAL ? DAY) WHERE id = ?`,
    [todayIso, todayIso, cadenceDays, report.leadId],
  );
  return getReport(id);
}

export async function countReports(): Promise<{ total: number; sentThisMonth: number }> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total,
            SUM(status = 'sent' AND sent_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')) AS sent_this_month
     FROM ${REPORTS}`,
  );
  return { total: Number(rows[0].total), sentThisMonth: Number(rows[0].sent_this_month ?? 0) };
}

/* ---------- settings ---------- */

export async function getSettings(): Promise<AppSettings> {
  const [rows] = await pool.query<RowDataPacket[]>(`SELECT * FROM ${SETTINGS} WHERE id = 1`);
  const r = rows[0];
  return {
    companyName: r.company_name,
    defaultRep: r.default_rep,
    cadenceDays: r.cadence_days,
    defaultSections: parseJson<string[]>(r.default_sections, []),
    aiPrompt: r.ai_prompt,
    aiModel: r.ai_model,
    logoDataUrl: r.logo_data_url,
    apiKeyConfigured: Boolean(process.env.OPENAI_API_KEY),
  };
}

export async function updateSettings(s: Partial<AppSettings>): Promise<AppSettings> {
  const map: Array<[string, unknown]> = [];
  if (s.companyName !== undefined) map.push(['company_name', s.companyName]);
  if (s.defaultRep !== undefined) map.push(['default_rep', s.defaultRep]);
  if (s.cadenceDays !== undefined) map.push(['cadence_days', s.cadenceDays]);
  if (s.defaultSections !== undefined) map.push(['default_sections', JSON.stringify(s.defaultSections)]);
  if (s.aiPrompt !== undefined) map.push(['ai_prompt', s.aiPrompt]);
  if (s.aiModel !== undefined) map.push(['ai_model', s.aiModel]);
  if (s.logoDataUrl !== undefined) map.push(['logo_data_url', s.logoDataUrl]);
  if (map.length) {
    await pool.query(
      `UPDATE ${SETTINGS} SET ${map.map(([c]) => `${c} = ?`).join(', ')} WHERE id = 1`,
      map.map(([, v]) => v),
    );
  }
  return getSettings();
}
