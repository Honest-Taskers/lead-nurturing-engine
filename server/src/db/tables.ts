/**
 * Table names carry the `lne_` prefix because production shares a MySQL
 * database with the main Honest Taskers platform. Use the same names in
 * every environment so SQL is identical in dev/staging/prod.
 */
export const LEADS = 'lne_leads';
export const REPORTS = 'lne_reports';
export const SETTINGS = 'lne_settings';
export const REPORT_IMAGES = 'lne_report_images';
