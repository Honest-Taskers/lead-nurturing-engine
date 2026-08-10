import { describe, it, expect, beforeEach, vi } from 'vitest';
import { stripCitations, generateReport, type GenerateInput } from './reportGenerator.js';
import type { Lead } from '../types.js';

describe('stripCitations', () => {
  it('unwraps markdown links to their text', () => {
    expect(stripCitations('See [the HFMA survey](https://hfma.org/survey) for details.')).toBe(
      'See the HFMA survey for details.',
    );
  });

  it('removes bare URL parentheticals', () => {
    expect(stripCitations('Denials rose 12% (https://beckers.com/denials-report).')).toBe(
      'Denials rose 12%.',
    );
  });

  it('removes domain-only parentheticals', () => {
    expect(stripCitations('Labor costs stay elevated (beckershospitalreview.com, 2026).')).toBe(
      'Labor costs stay elevated.',
    );
  });

  it('leaves ordinary parentheticals alone', () => {
    const text = 'Revenue cycle management (RCM) remains under pressure.';
    expect(stripCitations(text)).toBe(text);
  });
});

const lead: Lead = {
  id: 'lead-1',
  organization: 'CommonSpirit Health',
  industry: 'Hospital System',
  website: null,
  headquarters: 'Chicago, IL',
  orgSize: 'Enterprise; 150,000+',
  locationsReach: null,
  hiringSignal: null,
  personaName: 'Steve Scharmann',
  personaTitle: 'VP of Revenue Cycle',
  emails: null,
  linkedinUrl: null,
  phone: null,
  mailingAddress: null,
  assignedRep: 'Jaya',
  lastReportDate: null,
  nextDueDate: null,
};

const input: GenerateInput = {
  lead,
  focus: 'Revenue cycle management',
  template: 'Executive brief',
  sections: ['Industry overview', 'Key 2026 trends', 'How Honest Taskers helps'],
  aiPrompt: 'Write a brief for {title} at {company} in {industry}.',
  aiModel: 'gpt-5.1',
  companyName: 'Honest Taskers',
};

describe('generateReport (stub path, no OPENAI_API_KEY)', () => {
  beforeEach(() => {
    vi.stubEnv('OPENAI_API_KEY', '');
  });

  it('returns a deterministic stub report with the requested sections in order', async () => {
    const report = await generateReport(input);
    expect(report.model).toContain('stub');
    expect(report.title).toContain(input.focus);
    expect(report.sections.map((s) => s.key)).toEqual(input.sections);
    expect(report.coverImageUrl).toBeNull();
  });
});
