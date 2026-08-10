import { Router } from 'express';
import { z } from 'zod';
import * as repo from '../db/repo.js';

const router = Router();

const settingsSchema = z.object({
  companyName: z.string().min(1).optional(),
  defaultRep: z.string().min(1).optional(),
  cadenceDays: z.number().int().min(1).max(365).optional(),
  defaultSections: z.array(z.string()).optional(),
  aiPrompt: z.string().optional(),
  aiModel: z.string().optional(),
  logoDataUrl: z.string().nullish(),
});

router.get('/', async (_req, res) => {
  res.json(await repo.getSettings());
});

router.put('/', async (req, res) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid settings payload' });
  res.json(await repo.updateSettings(parsed.data));
});

export default router;
