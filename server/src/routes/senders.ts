import { Router } from 'express';
import { z } from 'zod';
import * as repo from '../db/repo.js';

const router = Router();

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Expected a #RRGGBB color');

const senderSchema = z.object({
  name: z.string().min(1),
  about: z.string().nullish(),
  logoDataUrl: z.string().nullish(),
  logoUrl: z.string().nullish(),
  brandPrimary: hexColor.optional(),
  brandSecondary: hexColor.optional(),
  fonts: z.string().nullish(),
  defaultRep: z.string().optional(),
  cadenceDays: z.number().int().min(1).max(365).optional(),
  defaultSections: z.array(z.string()).optional(),
  aiPrompt: z.string().optional(),
  aiModel: z.string().optional(),
});

const memberSchema = z.object({
  name: z.string().min(1),
  title: z.string().nullish(),
  email: z.string().nullish(),
  phone: z.string().nullish(),
  bio: z.string().nullish(),
  sortOrder: z.number().int().optional(),
});

router.get('/', async (_req, res) => {
  res.json(await repo.listSenders());
});

router.post('/', async (req, res) => {
  const parsed = senderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid sender' });
  res.status(201).json(await repo.createSender(parsed.data));
});

router.get('/:id', async (req, res) => {
  const sender = await repo.getSender(req.params.id);
  if (!sender) return res.status(404).json({ error: 'Sender not found' });
  res.json(sender);
});

router.put('/:id', async (req, res) => {
  const parsed = senderSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid sender' });
  const sender = await repo.updateSender(req.params.id, parsed.data);
  if (!sender) return res.status(404).json({ error: 'Sender not found' });
  res.json(sender);
});

/* ---------- team members ---------- */

router.get('/:id/team', async (req, res) => {
  const sender = await repo.getSender(req.params.id);
  if (!sender) return res.status(404).json({ error: 'Sender not found' });
  res.json(await repo.listTeamMembers(sender.id));
});

router.post('/:id/team', async (req, res) => {
  const sender = await repo.getSender(req.params.id);
  if (!sender) return res.status(404).json({ error: 'Sender not found' });
  const parsed = memberSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid team member' });
  res.status(201).json(await repo.addTeamMember(sender.id, parsed.data));
});

router.put('/:id/team/:memberId', async (req, res) => {
  const parsed = memberSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid team member' });
  const member = await repo.updateTeamMember(req.params.id, req.params.memberId, parsed.data);
  if (!member) return res.status(404).json({ error: 'Team member not found' });
  res.json(member);
});

router.delete('/:id/team/:memberId', async (req, res) => {
  const removed = await repo.deleteTeamMember(req.params.id, req.params.memberId);
  if (!removed) return res.status(404).json({ error: 'Team member not found' });
  res.status(204).end();
});

export default router;
