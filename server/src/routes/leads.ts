import { Router } from 'express';
import { z } from 'zod';
import * as repo from '../db/repo.js';

const router = Router();

const leadSchema = z.object({
  organization: z.string().min(1),
  industry: z.string().default(''),
  website: z.string().nullish(),
  logoUrl: z.string().nullish(),
  photoUrl: z.string().nullish(),
  headquarters: z.string().nullish(),
  orgSize: z.string().nullish(),
  locationsReach: z.string().nullish(),
  hiringSignal: z.string().nullish(),
  personaName: z.string().default(''),
  personaTitle: z.string().default(''),
  emails: z.string().nullish(),
  linkedinUrl: z.string().nullish(),
  contactPath: z.string().nullish(),
  phone: z.string().nullish(),
  mailingAddress: z.string().nullish(),
  assignedRep: z.string().optional(),
  lastReportDate: z.string().nullish(),
  nextDueDate: z.string().nullish(),
});

router.get('/', async (req, res) => {
  res.json(await repo.listLeads(req.senderId));
});

router.get('/:id', async (req, res) => {
  const lead = await repo.getLead(req.params.id);
  if (!lead || lead.senderId !== req.senderId) return res.status(404).json({ error: 'Lead not found' });
  const reports = await repo.listReportsForLead(lead.id);
  res.json({ lead, reports });
});

router.post('/', async (req, res) => {
  const parsed = leadSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid lead' });
  const settings = await repo.getSettings(req.senderId);
  const lead = await repo.createLead({ assignedRep: settings.defaultRep, ...parsed.data, senderId: req.senderId });
  res.status(201).json(lead);
});

router.put('/:id', async (req, res) => {
  const existing = await repo.getLead(req.params.id);
  if (!existing || existing.senderId !== req.senderId) return res.status(404).json({ error: 'Lead not found' });
  const parsed = leadSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid lead' });
  const lead = await repo.updateLead(req.params.id, parsed.data);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  res.json(lead);
});

router.post('/import', async (req, res) => {
  const parsed = z.array(leadSchema.partial()).safeParse(req.body?.leads ?? req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Expected an array of leads' });
  const settings = await repo.getSettings(req.senderId);
  const result = await repo.importLeads(parsed.data, settings.defaultRep, req.senderId);
  res.json(result);
});

export default router;
