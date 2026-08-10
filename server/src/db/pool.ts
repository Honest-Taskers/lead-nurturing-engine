import mysql from 'mysql2/promise';
import 'dotenv/config';

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('DATABASE_URL is not set — copy .env.example to .env and fill it in.');
}

export const pool = mysql.createPool({
  uri: url,
  waitForConnections: true,
  // Kept small: on Vercel each function instance holds its own pool, and the
  // production MySQL server is shared with the main platform.
  connectionLimit: 3,
  dateStrings: true, // DATE columns come back as 'YYYY-MM-DD' strings
  namedPlaceholders: true,
});
