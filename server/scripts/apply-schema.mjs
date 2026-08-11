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
  { table: 'lne_leads', name: 'sender_id', type: 'CHAR(36) NULL', after: 'id' },
  { table: 'lne_leads', name: 'logo_url', type: 'VARCHAR(500) NULL', after: 'website' },
  { table: 'lne_leads', name: 'photo_url', type: 'VARCHAR(500) NULL', after: 'logo_url' },
  { table: 'lne_leads', name: 'contact_path', type: 'VARCHAR(500) NULL', after: 'linkedin_url' },
  { table: 'lne_leads', name: 'emails', type: 'VARCHAR(500) NULL', minLength: 500 },
  { table: 'lne_leads', name: 'linkedin_url', type: 'VARCHAR(500) NULL', minLength: 500 },
  { table: 'lne_leads', name: 'phone', type: 'VARCHAR(120) NULL', minLength: 120 },
];

// Keep in sync with DEFAULT_SENDER_ID in src/db/tables.ts.
const DEFAULT_SENDER_ID = '00000000-0000-4000-8000-000000000001';

/**
 * Data backfills, idempotent via their WHERE clauses. Run after COLUMNS (so
 * the columns exist) and before INDEXES (so unique keys never see NULLs).
 */
const BACKFILLS = [
  {
    label: 'lne_leads.sender_id → default sender',
    sql: `UPDATE lne_leads SET sender_id = '${DEFAULT_SENDER_ID}' WHERE sender_id IS NULL`,
  },
];

/**
 * Index migrations guarded by information_schema (MySQL/TiDB have no
 * ADD INDEX IF NOT EXISTS). `replaces` names an old index to drop first.
 */
const INDEXES = [
  {
    table: 'lne_leads',
    name: 'uq_sender_org_persona',
    ddl: 'ADD UNIQUE KEY uq_sender_org_persona (sender_id, organization, persona_name)',
    replaces: 'uq_org_persona',
  },
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
  for (const backfill of BACKFILLS) {
    const [result] = await conn.query(backfill.sql);
    if (result.affectedRows > 0) changes.push(`${backfill.label} (${result.affectedRows} rows)`);
  }

  for (const idx of INDEXES) {
    const [[existing]] = await conn.query(
      `SELECT 1 AS present FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1`,
      [idx.table, idx.name],
    );
    if (existing) continue;
    if (idx.replaces) {
      const [[old]] = await conn.query(
        `SELECT 1 AS present FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1`,
        [idx.table, idx.replaces],
      );
      if (old) {
        await conn.query(`ALTER TABLE ${idx.table} DROP INDEX ${idx.replaces}`);
        changes.push(`-${idx.table}.${idx.replaces}`);
      }
    }
    await conn.query(`ALTER TABLE ${idx.table} ${idx.ddl}`);
    changes.push(`+${idx.table}.${idx.name}`);
  }

  console.log(changes.length ? `migrations ok — ${changes.join(', ')}` : 'migrations ok — nothing to change');
} finally {
  await conn.end();
}
