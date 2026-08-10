/**
 * Report cover images live in MySQL (lne_report_images) rather than on disk:
 * the app runs on serverless hosting where the filesystem is ephemeral.
 */
import type { RowDataPacket } from 'mysql2/promise';
import { pool } from './pool.js';
import { REPORT_IMAGES } from './tables.js';

export interface StoredImage {
  name: string;
  mime: string;
  data: Buffer;
}

export async function saveImage(name: string, mime: string, data: Buffer): Promise<void> {
  await pool.query(
    `INSERT INTO ${REPORT_IMAGES} (name, mime, data) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE mime = VALUES(mime), data = VALUES(data)`,
    [name, mime, data],
  );
}

export async function getImage(name: string): Promise<StoredImage | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT name, mime, data FROM ${REPORT_IMAGES} WHERE name = ?`,
    [name],
  );
  return rows[0] ? { name: rows[0].name, mime: rows[0].mime, data: rows[0].data } : null;
}
