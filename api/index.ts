/**
 * Vercel serverless entry point. All /api/* requests are rewritten here
 * (see vercel.json); Vercel passes the original URL through, so the Express
 * router sees the full /api/... path exactly as in local dev.
 *
 * The dynamic import + catch turns boot-time failures (bad env, missing
 * module) into a readable JSON response instead of an opaque
 * FUNCTION_INVOCATION_FAILED.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';

let handler: (req: IncomingMessage, res: ServerResponse) => void;

try {
  const mod = await import('../server/src/app.js');
  handler = mod.default as unknown as typeof handler;
} catch (err) {
  const detail = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err);
  console.error('API boot failure:', detail);
  handler = (_req, res) => {
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ error: 'API failed to start', detail }));
  };
}

export default handler;
