/**
 * Sender-model integration tests. Same gating as app.test.ts: they need a
 * real disposable MySQL via TEST_DATABASE_URL (CI provides mysql:8).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import request from 'supertest';

const RUN = Boolean(process.env.TEST_DATABASE_URL);
const here = path.dirname(fileURLToPath(import.meta.url));

const TEST_ORG_PREFIX = 'ZZ Scoped Test Org';
const testOrg = `${TEST_ORG_PREFIX} ${randomUUID().slice(0, 8)}`;

describe.runIf(RUN)('Sender model', () => {
  let app: import('express').Express;
  let pool: import('mysql2/promise').Pool;
  let senderB: { id: string };

  beforeAll(async () => {
    ({ default: app } = await import('./app.js'));
    ({ pool } = await import('./db/pool.js'));
    const schema = readFileSync(path.join(here, 'db/schema.sql'), 'utf8');
    for (const stmt of schema.split(/;\s*(?:\r?\n|$)/).filter((s) => s.trim())) {
      await pool.query(stmt);
    }
  });

  afterAll(async () => {
    const { LEADS, SENDERS } = await import('./db/tables.js');
    await pool?.query(`DELETE FROM ${LEADS} WHERE organization LIKE ?`, [`${TEST_ORG_PREFIX}%`]);
    if (senderB?.id) await pool?.query(`DELETE FROM ${SENDERS} WHERE id = ?`, [senderB.id]);
    await pool?.end();
  });

  it('lists senders including the default (Honest Taskers) sender', async () => {
    const res = await request(app).get('/api/senders');
    expect(res.status).toBe(200);
    expect(res.body.some((x: { isDefault: boolean }) => x.isDefault)).toBe(true);
  });

  it('creates a sender with brand identity and manages its team', async () => {
    const created = await request(app).post('/api/senders').send({
      name: 'ZZ Test Financial',
      about: 'Test advisory firm.',
      brandPrimary: '#0F3D2E',
      brandSecondary: '#C9A227',
      defaultRep: 'Morgan',
    });
    expect(created.status).toBe(201);
    senderB = created.body;
    expect(created.body.brandPrimary).toBe('#0F3D2E');
    expect(created.body.isDefault).toBe(false);

    const member = await request(app).post(`/api/senders/${senderB.id}/team`).send({ name: 'Morgan Lee', title: 'Principal' });
    expect(member.status).toBe(201);

    const team = await request(app).get(`/api/senders/${senderB.id}/team`);
    expect(team.status).toBe(200);
    expect(team.body).toHaveLength(1);

    const updated = await request(app).put(`/api/senders/${senderB.id}/team/${member.body.id}`).send({ title: 'Managing Partner' });
    expect(updated.body.title).toBe('Managing Partner');

    const removed = await request(app).delete(`/api/senders/${senderB.id}/team/${member.body.id}`);
    expect(removed.status).toBe(204);
  });

  it('rejects invalid brand colors', async () => {
    const res = await request(app).post('/api/senders').send({ name: 'Bad Colors', brandPrimary: 'navy' });
    expect(res.status).toBe(400);
  });

  it('scopes leads to their sender', async () => {
    // Create a lead under sender B via the header.
    const created = await request(app)
      .post('/api/leads')
      .set('X-Sender-Id', senderB.id)
      .send({ organization: testOrg, industry: 'Wealth Management', personaName: 'Pat Scoped', personaTitle: 'CIO' });
    expect(created.status).toBe(201);
    expect(created.body.senderId).toBe(senderB.id);
    expect(created.body.assignedRep).toBe('Morgan'); // sender B's default rep

    // Default-sender list must NOT contain it; sender B's list must.
    const defaultList = await request(app).get('/api/leads');
    expect(defaultList.body.some((l: { id: string }) => l.id === created.body.id)).toBe(false);
    const bList = await request(app).get('/api/leads').set('X-Sender-Id', senderB.id);
    expect(bList.body.some((l: { id: string }) => l.id === created.body.id)).toBe(true);

    // Cross-sender detail access 404s.
    const crossDetail = await request(app).get(`/api/leads/${created.body.id}`);
    expect(crossDetail.status).toBe(404);
    const ownDetail = await request(app).get(`/api/leads/${created.body.id}`).set('X-Sender-Id', senderB.id);
    expect(ownDetail.status).toBe(200);
  });

  it('lets two senders hold the same organization + persona', async () => {
    const dup = await request(app)
      .post('/api/leads')
      .send({ organization: testOrg, industry: 'Wealth Management', personaName: 'Pat Scoped', personaTitle: 'CIO' });
    expect(dup.status).toBe(201); // default sender — no unique-key clash with sender B's row
  });

  it('settings are sender-scoped through the same header', async () => {
    const bSettings = await request(app).get('/api/settings').set('X-Sender-Id', senderB.id);
    expect(bSettings.body.companyName).toBe('ZZ Test Financial');
    expect(bSettings.body.brandPrimary).toBe('#0F3D2E');

    const defaults = await request(app).get('/api/settings');
    expect(defaults.body.companyName).not.toBe('ZZ Test Financial');
  });

  it('404s on an unknown sender header', async () => {
    const res = await request(app).get('/api/leads').set('X-Sender-Id', randomUUID());
    expect(res.status).toBe(404);
  });
});
