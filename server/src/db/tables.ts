/**
 * Table names carry the `lne_` prefix because production shares a MySQL
 * database with the main Honest Taskers platform. Use the same names in
 * every environment so SQL is identical in dev/staging/prod.
 */
export const LEADS = 'lne_leads';
export const REPORTS = 'lne_reports';
export const SETTINGS = 'lne_settings';
export const REPORT_IMAGES = 'lne_report_images';
export const SENDERS = 'lne_senders';
export const TEAM_MEMBERS = 'lne_team_members';

/**
 * Fixed id of the sender created from the legacy lne_settings singleton
 * (Honest Taskers). Deterministic so schema migration, backfill, seeds and
 * header-less API requests all agree without lookups.
 */
export const DEFAULT_SENDER_ID = '00000000-0000-4000-8000-000000000001';
