import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { pool } from './db/pool.js';
import { getImage } from './db/images.js';
import leadsRouter from './routes/leads.js';
import reportsRouter from './routes/reports.js';
import settingsRouter from './routes/settings.js';

const app = express();

// Staging/prod are same-origin (the SPA and API share a domain); dev goes
// through the Vite proxy. CORS is only needed for ad-hoc local tooling.
if (process.env.NODE_ENV !== 'production') {
  app.use(cors());
}
app.use(express.json({ limit: '5mb' })); // logo data URLs

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, db: 'up', aiConfigured: Boolean(process.env.OPENAI_API_KEY) });
  } catch {
    res.status(503).json({ ok: false, db: 'down' });
  }
});

// Generated cover illustrations, stored as BLOBs (serverless has no persistent disk).
app.get('/api/images/:name', async (req, res) => {
  const image = await getImage(req.params.name);
  if (!image) return res.status(404).json({ error: 'Image not found' });
  res.setHeader('Content-Type', image.mime);
  res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
  res.send(image.data);
});

app.use('/api/leads', leadsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/settings', settingsRouter);

// Unknown API paths must return JSON, never fall through to the SPA.
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Central error handler (async route errors bubble here in Express 5)
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
