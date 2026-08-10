/**
 * Local dev entry point. On Vercel the app is served by api/index.ts instead;
 * the frontend is served by Vercel's static hosting, so this process only
 * needs to answer /api requests (the Vite dev server proxies them here).
 */
import app from './app.js';

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`Relationship Engine API listening on http://localhost:${port}`);
});
