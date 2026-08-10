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

const conn = await mysql.createConnection({ uri: process.env.DATABASE_URL });
try {
  for (const stmt of statements) {
    await conn.query(stmt);
  }
  console.log(`schema ok — ${statements.length} statements applied from ${path.basename(schemaPath)}`);
} finally {
  await conn.end();
}
