/**
 * Vercel serverless entry point. All /api/* requests are rewritten here
 * (see vercel.json); Vercel passes the original URL through, so the Express
 * router sees the full /api/... path exactly as in local dev.
 */
import app from '../server/src/app.js';

export default app;
