/**
 * API integration tests. They need a real, disposable MySQL — set
 * TEST_DATABASE_URL to enable them (CI provides a mysql:8 service container).
 * Without it the suite is skipped so `npm test` stays green locally.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import request from 'supertest';

const RUN = Boolean(process.env.TEST_DATABASE_URL);
const here = path.dirname(fileURLToPath(import.meta.url));

describe.runIf(RUN)('API integration', () => {
  let app: import('express').Express;
  let pool: import('mysql2/promise').Pool;

  beforeAll(async () => {
    ({ default: app } = await import('./app.js'));
    ({ pool } = await import('./db/pool.js'));

    // Apply schema + settings singleton (fresh CI database).
    const schema = readFileSync(path.join(here, 'db/schema.sql'), 'utf8');
    for (const stmt of schema.split(/;\s*(?:\r?\n|$)/).filter((s) => s.trim())) {
      await pool.query(stmt);
    }
    const { SETTINGS } = await import('./db/tables.js');
    await pool.query(
      `INSERT INTO ${SETTINGS} (id, company_name, default_rep, cadence_days, default_sections, ai_prompt, ai_model)
       VALUES (1, 'Honest Taskers', 'Jaya', 14, ?, 'Test prompt for {company}', 'gpt-5.1')
       ON DUPLICATE KEY UPDATE id = id`,
      [JSON.stringify(['Industry overview'])],
    );
  });

  afterAll(async () => {
    await pool?.end();
  });

  it('GET /api/health reports the database as up', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.db).toBe('up');
  });

  it('POST /api/leads creates a lead and GET /api/leads returns it', async () => {
    const created = await request(app).post('/api/leads').send({
      organization: 'Test Health System',
      industry: 'Hospital System',
      personaName: 'Pat Tester',
      personaTitle: 'VP of Testing',
    });
    expect(created.status).toBe(201);
    expect(created.body.id).toBeTruthy();
    expect(created.body.assignedRep).toBe('Jaya');

    const list = await request(app).get('/api/leads');
    expect(list.status).toBe(200);
    expect(list.body.some((l: { id: string }) => l.id === created.body.id)).toBe(true);

    const detail = await request(app).get(`/api/leads/${created.body.id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.lead.organization).toBe('Test Health System');
    expect(detail.body.reports).toEqual([]);
  });

  it('POST /api/leads rejects a lead without an organization', async () => {
    const res = await request(app).post('/api/leads').send({ personaName: 'No Org' });
    expect(res.status).toBe(400);
  });

  it('GET /api/images/:name returns 404 JSON for a missing image', async () => {
    const res = await request(app).get('/api/images/nope.png');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeTruthy();
  });

  it('unknown /api paths return JSON 404, not HTML', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toContain('application/json');
  });
});
