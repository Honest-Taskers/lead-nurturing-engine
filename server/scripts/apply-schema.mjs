/**
 * Applies src/db/schema.sql (idempotent CREATE TABLE IF NOT EXISTS) to the
 * database in DATABASE_URL. Safe to run repeatedly and against production —
 * it never inserts data. Plain Node + runtime deps only (no tsx needed).
 *
 * Usage:
 *   npm run db:schema                          # uses server/.env
 *   DATABASE_URL=mysql://... npm run db:schema # explicit target
 *   node scripts/apply-schema.mjs [path/to/schema.sql]
 */
import 'dotenv/config';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';

const here = path.dirname(fileURLToPath(import.meta.url));
const schemaPath =
  process.argv[2] ??
  [path.join(here, '../src/db/schema.sql'), path.join(here, '../db/schema.sql')].find(existsSync);

if (!schemaPath || !existsSync(schemaPath)) {
  console.error('schema.sql not found');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const sql = readFileSync(schemaPath, 'utf8');
const statements = sql
  .split(/;\s*(?:\r?\n|$)/)
  .map((s) => s.trim())
  .filter(Boolean);

/**
 * Column-level migrations for databases created before a column existed.
 * MySQL/TiDB have no ADD COLUMN IF NOT EXISTS, so each one is guarded by an
 * information_schema lookup — making this script safe to re-run anywhere.
 * `minLength` widens an existing column that is narrower than the target.
 */
const COLUMNS = [
  { table: 'lne_leads', name: 'logo_url', type: 'VARCHAR(500) NULL', after: 'website' },
  { table: 'lne_leads', name: 'contact_path', type: 'VARCHAR(500) NULL', after: 'linkedin_url' },
  { table: 'lne_leads', name: 'emails', type: 'VARCHAR(500) NULL', minLength: 500 },
  { table: 'lne_leads', name: 'linkedin_url', type: 'VARCHAR(500) NULL', minLength: 500 },
  { table: 'lne_leads', name: 'phone', type: 'VARCHAR(120) NULL', minLength: 120 },
];

const conn = await mysql.createConnection({ uri: process.env.DATABASE_URL });
try {
  for (const stmt of statements) {
    await conn.query(stmt);
  }
  console.log(`schema ok — ${statements.length} statements applied from ${path.basename(schemaPath)}`);

  const changes = [];
  for (const col of COLUMNS) {
    const [[existing]] = await conn.query(
      `SELECT CHARACTER_MAXIMUM_LENGTH AS len FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [col.table, col.name],
    );
    if (!existing) {
      await conn.query(
        `ALTER TABLE ${col.table} ADD COLUMN ${col.name} ${col.type}${col.after ? ` AFTER ${col.after}` : ''}`,
      );
      changes.push(`+${col.table}.${col.name}`);
    } else if (col.minLength && Number(existing.len) < col.minLength) {
      await conn.query(`ALTER TABLE ${col.table} MODIFY ${col.name} ${col.type}`);
      changes.push(`~${col.table}.${col.name}`);
    }
  }
  console.log(changes.length ? `migrations ok — ${changes.join(', ')}` : 'migrations ok — nothing to change');
} finally {
  await conn.end();
}
