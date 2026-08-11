import { Router } from 'express';
import { z } from 'zod';
import * as repo from '../db/repo.js';
import { generateReport } from '../services/reportGenerator.js';
import { renderReportPdf } from '../services/reportPdf.js';
import { normalizeRequestedSections } from '../types.js';

const router = Router();

const generateSchema = z.object({
  leadId: z.string().min(1),
  focus: z.string().min(1),
  template: z.string().min(1),
  sections: z.array(z.string()).min(1),
});

router.post('/generate', async (req, res) => {
  const parsed = generateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'leadId, focus, template, and sections are required' });

  const lead = await repo.getLead(parsed.data.leadId);
  if (!lead || lead.senderId !== req.senderId) return res.status(404).json({ error: 'Lead not found' });
  // Brand + report prefs come from the lead's owning sender.
  const settings = await repo.getSettings(lead.senderId ?? undefined);

  try {
    const generated = await generateReport({
      lead,
      focus: parsed.data.focus,
      template: parsed.data.template,
      // Mandatory sections (exec summary, takeaways, closing) wrap whatever
      // body sections the client requested; legacy names are normalized.
      sections: normalizeRequestedSections(parsed.data.sections),
      aiPrompt: settings.aiPrompt,
      aiModel: settings.aiModel,
      companyName: settings.companyName,
      about: settings.about,
      brandPrimary: settings.brandPrimary,
      brandSecondary: settings.brandSecondary,
    });

    const pad = (n: number) => String(n).padStart(2, '0');
    const now = new Date();
    const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

    const report = await repo.createReport({
      leadId: lead.id,
      title: generated.title,
      dek: generated.dek,
      badge: generated.badge,
      coverImageUrl: generated.coverImageUrl,
      focus: parsed.data.focus,
      template: parsed.data.template,
      sections: generated.sections,
      publications: generated.publications,
      status: 'generated',
      generatedAt: today,
      model: generated.model,
    });
    res.status(201).json(report);
  } catch (err) {
    // Log the full error server-side only — raw messages can carry secrets
    // (e.g. a malformed Authorization header echoes the API key).
    console.error('report generation failed:', err);
    res.status(502).json({ error: 'Report generation failed — check the server logs for details' });
  }
});

router.get('/stats', async (req, res) => {
  res.json(await repo.countReports(req.senderId));
});

router.get('/:id', async (req, res) => {
  const report = await repo.getReport(req.params.id);
  if (!report) return res.status(404).json({ error: 'Report not found' });
  res.json(report);
});

/** Designed print PDF (585×783pt editorial template, vector text, embedded fonts). */
router.get('/:id/pdf', async (req, res) => {
  const report = await repo.getReport(req.params.id);
  if (!report) return res.status(404).json({ error: 'Report not found' });
  const lead = await repo.getLead(report.leadId);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  const settings = await repo.getSettings(lead.senderId ?? undefined);
  try {
    const stream = await renderReportPdf(report, lead, settings);
    const safeName = report.title.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-') || 'report';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}.pdf"`);
    stream.on('error', (err) => {
      // Headers are already out, so the download just aborts; log for diagnosis.
      console.error('pdf stream failed:', err);
      res.destroy();
    });
    stream.pipe(res);
  } catch (err) {
    console.error('pdf render failed:', err);
    res.status(500).json({ error: 'PDF rendering failed' });
  }
});

router.post('/:id/mark-sent', async (req, res) => {
  const existing = await repo.getReport(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Report not found' });
  const lead = await repo.getLead(existing.leadId);
  const settings = await repo.getSettings(lead?.senderId ?? undefined);
  const report = await repo.markReportSent(req.params.id, settings.cadenceDays);
  if (!report) return res.status(404).json({ error: 'Report not found' });
  res.json(report);
});

export default router;
