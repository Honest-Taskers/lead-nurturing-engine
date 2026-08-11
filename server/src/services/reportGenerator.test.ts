import { describe, it, expect, beforeEach, vi } from 'vitest';
import { stripCitations, generateReport, validateReport, type GenerateInput } from './reportGenerator.js';
import { normalizeRequestedSections, type Lead } from '../types.js';

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
  // As composed by the server: legacy client names normalized, mandatory sections injected.
  sections: normalizeRequestedSections(['Industry overview', 'Key 2026 trends', 'How Honest Taskers helps']),
  aiPrompt: 'Write a brief for {title} at {company} in {industry}.',
  aiModel: 'gpt-5.1',
  companyName: 'Honest Taskers',
};

describe('normalizeRequestedSections', () => {
  it('wraps body sections with the mandatory structure', () => {
    expect(normalizeRequestedSections(['Industry overview'])).toEqual([
      'Executive summary',
      'Industry overview',
      'Actionable takeaways',
      'Closing note',
    ]);
  });

  it('renames legacy keys, drops unknowns and mandatory duplicates, dedupes', () => {
    expect(
      normalizeRequestedSections([
        'Key 2026 trends',
        'How Honest Taskers helps',
        'Executive summary',
        'Made up section',
        'Industry overview',
        'Industry overview',
      ]),
    ).toEqual(['Executive summary', 'Key trends & data', 'Industry overview', 'Actionable takeaways', 'Closing note']);
  });
});

describe('generateReport (stub path, no OPENAI_API_KEY)', () => {
  beforeEach(() => {
    vi.stubEnv('OPENAI_API_KEY', '');
  });

  it('returns a deterministic stub report with the composed sections in order', async () => {
    const report = await generateReport(input);
    expect(report.model).toContain('stub');
    expect(report.title).toContain(input.focus);
    expect(report.sections.map((s) => s.key)).toEqual(input.sections);
    expect(report.coverImageUrl).toBeNull();
  });

  it('produces a stub that passes structural validation', async () => {
    const report = await generateReport(input);
    const { hard } = validateReport(report, input.sections);
    expect(hard).toEqual([]);
  });
});

describe('validateReport', () => {
  const base = async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    return generateReport(input);
  };

  it('flags wrong section order as a hard violation', async () => {
    const report = await base();
    const reversed = { ...report, sections: [...report.sections].reverse() };
    expect(validateReport(reversed, input.sections).hard.some((v) => v.includes('order'))).toBe(true);
  });

  it('flags missing or duplicate charts', async () => {
    const report = await base();
    const noChart = { ...report, sections: report.sections.map((s) => ({ ...s, chart: null })) };
    expect(validateReport(noChart, input.sections).hard.some((v) => v.includes('chart'))).toBe(true);
  });

  it('flags a takeaways section with too few items', async () => {
    const report = await base();
    const clipped = {
      ...report,
      sections: report.sections.map((s) =>
        s.key === 'Actionable takeaways' ? { ...s, numberedItems: s.numberedItems!.slice(0, 2) } : s,
      ),
    };
    expect(validateReport(clipped, input.sections).hard.some((v) => v.includes('takeaways'))).toBe(true);
  });

  it('reports soft violations without failing hard', async () => {
    const report = await base();
    const longTitle = { ...report, title: 'a very long report title that has way too many words in it' };
    const result = validateReport(longTitle, input.sections);
    expect(result.soft.some((v) => v.includes('title'))).toBe(true);
    expect(result.hard).toEqual([]);
  });
});
