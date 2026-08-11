import mysql from 'mysql2/promise';
import 'dotenv/config';

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('DATABASE_URL is not set — copy .env.example to .env and fill it in.');
}

const raw = mysql.createPool({
  uri: url,
  waitForConnections: true,
  // Kept small: on Vercel each function instance holds its own pool, and the
  // production MySQL server is shared with the main platform.
  connectionLimit: 3,
  // TiDB Cloud Serverless silently kills idle connections; a report generation
  // can take many minutes, after which the pooled connections are dead
  // (read ECONNRESET / HANDSHAKE_SSL_ERROR). Close idle connections ourselves
  // first so the pool never hands out a stale one.
  maxIdle: 3,
  idleTimeout: 60_000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10_000,
  dateStrings: true, // DATE columns come back as 'YYYY-MM-DD' strings
  namedPlaceholders: true,
});

/** Errors that mean "this pooled connection died under us" — safe to retry once. */
const RETRYABLE = new Set(['ECONNRESET', 'EPIPE', 'ETIMEDOUT', 'PROTOCOL_CONNECTION_LOST', 'HANDSHAKE_SSL_ERROR', 'CONN_CLOSED']);

function isRetryable(err: unknown): boolean {
  const e = err as { code?: string; fatal?: boolean } | null;
  return Boolean(e && (RETRYABLE.has(e.code ?? '') || e.fatal === true));
}

type QueryFn = typeof raw.query;

/**
 * The exported pool retries a query exactly once when it fails on a dead
 * connection (the retry draws a fresh connection from the pool). Non-connection
 * errors (SQL errors, constraint violations) are never retried.
 */
export const pool = new Proxy(raw, {
  get(target, prop, receiver) {
    if (prop === 'query') {
      const query = ((...args: Parameters<QueryFn>) =>
        target.query(...args).catch((err: unknown) => {
          if (!isRetryable(err)) throw err;
          console.warn(`db connection dropped (${(err as { code?: string }).code}); retrying query once`);
          return target.query(...args);
        })) as QueryFn;
      return query;
    }
    return Reflect.get(target, prop, receiver);
  },
});
