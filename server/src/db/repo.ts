import { randomUUID } from 'node:crypto';
import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { pool } from './pool.js';
import { DEFAULT_SENDER_ID, LEADS, REPORTS, SENDERS, TEAM_MEMBERS } from './tables.js';
import { logoUrlForWebsite, withLogoToken } from '../services/logo.js';
import {
  BODY_SECTIONS,
  type AppSettings,
  type Lead,
  type Report,
  type ReportSection,
  type Sender,
  type TeamMember,
} from '../types.js';

/** Legacy defaultSections values → current body-section names (mandatory sections are injected at generate time). */
function normalizeDefaultSections(stored: string[]): string[] {
  const renames: Record<string, string> = { 'Key 2026 trends': 'Key trends & data' };
  const body = stored
    .map((s) => renames[s] ?? s)
    .filter((s) => (BODY_SECTIONS as readonly string[]).includes(s));
  const deduped = [...new Set(body)];
  return deduped.length ? deduped : [...BODY_SECTIONS];
}

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
    senderId: r.sender_id,
    organization: r.organization,
    industry: r.industry,
    website: r.website,
    logoUrl: withLogoToken(r.logo_url),
    photoUrl: r.photo_url,
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
  sender_id: 'senderId',
  organization: 'organization',
  industry: 'industry',
  website: 'website',
  logo_url: 'logoUrl',
  photo_url: 'photoUrl',
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

export async function listLeads(senderId: string): Promise<Lead[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM ${LEADS} WHERE sender_id = ? ORDER BY created_at DESC, organization`,
    [senderId],
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

/** Import with dedupe on (sender, organization, persona_name). */
export async function importLeads(
  rows: Array<Partial<Lead>>,
  defaultRep: string,
  senderId: string,
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
        senderId,
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

export async function countReports(senderId: string): Promise<{ total: number; sentThisMonth: number }> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total,
            SUM(r.status = 'sent' AND r.sent_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')) AS sent_this_month
     FROM ${REPORTS} r JOIN ${LEADS} l ON l.id = r.lead_id
     WHERE l.sender_id = ?`,
    [senderId],
  );
  return { total: Number(rows[0].total), sentThisMonth: Number(rows[0].sent_this_month ?? 0) };
}

/* ---------- senders ---------- */

function rowToSender(r: RowDataPacket): Sender {
  return {
    id: r.id,
    name: r.name,
    about: r.about,
    logoDataUrl: r.logo_data_url,
    logoUrl: r.logo_url,
    brandPrimary: r.brand_primary,
    brandSecondary: r.brand_secondary,
    fonts: r.fonts,
    defaultRep: r.default_rep,
    cadenceDays: r.cadence_days,
    defaultSections: normalizeDefaultSections(parseJson<string[]>(r.default_sections, [])),
    aiPrompt: r.ai_prompt,
    aiModel: r.ai_model,
    isDefault: Boolean(r.is_default),
  };
}

export async function listSenders(): Promise<Sender[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM ${SENDERS} ORDER BY is_default DESC, created_at, name`,
  );
  return rows.map(rowToSender);
}

export async function getSender(id: string): Promise<Sender | null> {
  const [rows] = await pool.query<RowDataPacket[]>(`SELECT * FROM ${SENDERS} WHERE id = ?`, [id]);
  return rows[0] ? rowToSender(rows[0]) : null;
}

const SENDER_COLUMNS: Record<string, keyof Sender> = {
  name: 'name',
  about: 'about',
  logo_data_url: 'logoDataUrl',
  logo_url: 'logoUrl',
  brand_primary: 'brandPrimary',
  brand_secondary: 'brandSecondary',
  fonts: 'fonts',
  default_rep: 'defaultRep',
  cadence_days: 'cadenceDays',
  ai_prompt: 'aiPrompt',
  ai_model: 'aiModel',
};

const SENDER_DEFAULT_PROMPT =
  'Write a concise, executive industry brief for {title} at {company} in {industry}. Cite real trends & publications. Warm, credible, non-salesy.';

export async function createSender(input: Partial<Sender> & { name: string }): Promise<Sender> {
  const id = input.id ?? randomUUID();
  await pool.query(
    `INSERT INTO ${SENDERS} (id, name, about, logo_data_url, logo_url, brand_primary, brand_secondary, fonts,
                             default_rep, cadence_days, default_sections, ai_prompt, ai_model, is_default)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [
      id,
      input.name,
      input.about ?? null,
      input.logoDataUrl ?? null,
      input.logoUrl ?? null,
      input.brandPrimary ?? '#203667',
      input.brandSecondary ?? '#F7B84A',
      input.fonts ?? null,
      input.defaultRep ?? '',
      input.cadenceDays ?? 14,
      JSON.stringify(input.defaultSections ?? BODY_SECTIONS),
      input.aiPrompt ?? SENDER_DEFAULT_PROMPT,
      input.aiModel ?? 'gpt-5.1',
    ],
  );
  return (await getSender(id))!;
}

export async function updateSender(id: string, input: Partial<Sender>): Promise<Sender | null> {
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [col, key] of Object.entries(SENDER_COLUMNS)) {
    if (key in input) {
      sets.push(`${col} = ?`);
      values.push(input[key] ?? null);
    }
  }
  if ('defaultSections' in input) {
    sets.push('default_sections = ?');
    values.push(JSON.stringify(input.defaultSections ?? BODY_SECTIONS));
  }
  if (sets.length) {
    values.push(id);
    await pool.query(`UPDATE ${SENDERS} SET ${sets.join(', ')} WHERE id = ?`, values);
  }
  return getSender(id);
}

/* ---------- team members ---------- */

function rowToTeamMember(r: RowDataPacket): TeamMember {
  return {
    id: r.id,
    senderId: r.sender_id,
    name: r.name,
    title: r.title,
    email: r.email,
    phone: r.phone,
    bio: r.bio,
    sortOrder: r.sort_order,
  };
}

export async function listTeamMembers(senderId: string): Promise<TeamMember[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM ${TEAM_MEMBERS} WHERE sender_id = ? ORDER BY sort_order, name`,
    [senderId],
  );
  return rows.map(rowToTeamMember);
}

export async function addTeamMember(senderId: string, input: Partial<TeamMember> & { name: string }): Promise<TeamMember> {
  const id = input.id ?? randomUUID();
  await pool.query(
    `INSERT INTO ${TEAM_MEMBERS} (id, sender_id, name, title, email, phone, bio, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, senderId, input.name, input.title ?? null, input.email ?? null, input.phone ?? null, input.bio ?? null, input.sortOrder ?? 0],
  );
  const [rows] = await pool.query<RowDataPacket[]>(`SELECT * FROM ${TEAM_MEMBERS} WHERE id = ?`, [id]);
  return rowToTeamMember(rows[0]);
}

export async function updateTeamMember(senderId: string, memberId: string, input: Partial<TeamMember>): Promise<TeamMember | null> {
  const cols: Record<string, keyof TeamMember> = { name: 'name', title: 'title', email: 'email', phone: 'phone', bio: 'bio', sort_order: 'sortOrder' };
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [col, key] of Object.entries(cols)) {
    if (key in input) {
      sets.push(`${col} = ?`);
      values.push(input[key] ?? null);
    }
  }
  if (sets.length) {
    values.push(memberId, senderId);
    await pool.query(`UPDATE ${TEAM_MEMBERS} SET ${sets.join(', ')} WHERE id = ? AND sender_id = ?`, values);
  }
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM ${TEAM_MEMBERS} WHERE id = ? AND sender_id = ?`,
    [memberId, senderId],
  );
  return rows[0] ? rowToTeamMember(rows[0]) : null;
}

export async function deleteTeamMember(senderId: string, memberId: string): Promise<boolean> {
  const [result] = await pool.query<ResultSetHeader>(
    `DELETE FROM ${TEAM_MEMBERS} WHERE id = ? AND sender_id = ?`,
    [memberId, senderId],
  );
  return result.affectedRows > 0;
}

/* ---------- settings (sender-scoped shim) ---------- */

/**
 * The legacy /api/settings contract, served from the resolved sender's row
 * (lne_settings is no longer read). companyName ↔ sender.name and
 * logoDataUrl ↔ sender.logo_data_url; brand fields ride along for the PDF.
 */
export async function getSettings(senderId: string = DEFAULT_SENDER_ID): Promise<AppSettings> {
  const sender = (await getSender(senderId)) ?? (await getSender(DEFAULT_SENDER_ID));
  if (!sender) throw new Error('No sender configured — run npm run db:schema to bootstrap');
  return {
    companyName: sender.name,
    defaultRep: sender.defaultRep,
    cadenceDays: sender.cadenceDays,
    defaultSections: sender.defaultSections,
    aiPrompt: sender.aiPrompt,
    aiModel: sender.aiModel,
    logoDataUrl: sender.logoDataUrl,
    about: sender.about,
    brandPrimary: sender.brandPrimary,
    brandSecondary: sender.brandSecondary,
    fonts: sender.fonts,
    apiKeyConfigured: Boolean(process.env.OPENAI_API_KEY),
  };
}

export async function updateSettings(s: Partial<AppSettings>, senderId: string = DEFAULT_SENDER_ID): Promise<AppSettings> {
  await updateSender(senderId, {
    ...(s.companyName !== undefined ? { name: s.companyName } : {}),
    ...(s.defaultRep !== undefined ? { defaultRep: s.defaultRep } : {}),
    ...(s.cadenceDays !== undefined ? { cadenceDays: s.cadenceDays } : {}),
    ...(s.defaultSections !== undefined ? { defaultSections: s.defaultSections } : {}),
    ...(s.aiPrompt !== undefined ? { aiPrompt: s.aiPrompt } : {}),
    ...(s.aiModel !== undefined ? { aiModel: s.aiModel } : {}),
    ...(s.logoDataUrl !== undefined ? { logoDataUrl: s.logoDataUrl } : {}),
    ...(s.about !== undefined ? { about: s.about } : {}),
    ...(s.brandPrimary != null ? { brandPrimary: s.brandPrimary } : {}),
    ...(s.brandSecondary != null ? { brandSecondary: s.brandSecondary } : {}),
    ...(s.fonts !== undefined ? { fonts: s.fonts } : {}),
  });
  return getSettings(senderId);
}
