import type { AppSettings, Lead, Report, Sender, TeamMember } from '../data/types';

/**
 * Active sender for API scoping — set by AppContext before any scoped call.
 * Absent header = the server's default (Honest Taskers) sender.
 */
let activeSenderId: string | null = null;
export function setActiveSenderId(id: string | null): void {
  activeSenderId = id;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(activeSenderId ? { 'X-Sender-Id': activeSenderId } : {}),
    },
    ...init,
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // keep default message
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

/** Progress phases the server emits while a report generates. */
export type GenerationPhase = 'research' | 'writing' | 'goal-check' | 'repair' | 'images' | 'saving';
export interface GenerationProgress {
  phase: GenerationPhase;
  detail?: string;
}

/**
 * Streaming report generation: parses the server's SSE stream, invoking
 * `onProgress` per pipeline phase and resolving with the saved report.
 * Aborting `signal` cancels the in-flight generation server-side.
 */
export async function generateReportStream(
  input: { leadId: string; focus: string; template: string; sections: string[] },
  opts: { onProgress?: (p: GenerationProgress) => void; signal?: AbortSignal } = {},
): Promise<Report> {
  const res = await fetch('/api/reports/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...(activeSenderId ? { 'X-Sender-Id': activeSenderId } : {}),
    },
    body: JSON.stringify(input),
    signal: opts.signal,
  });
  if (!res.ok || !res.body) {
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // keep default message
    }
    throw new Error(message);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let report: Report | null = null;
  let errorMessage: string | null = null;

  const handle = (block: string) => {
    let event = 'message';
    let data = '';
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) data += line.slice(5).trim();
    }
    if (!data) return;
    if (event === 'progress') opts.onProgress?.(JSON.parse(data) as GenerationProgress);
    else if (event === 'done') report = JSON.parse(data) as Report;
    else if (event === 'error') errorMessage = (JSON.parse(data) as { error?: string }).error ?? 'Report generation failed';
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      handle(buffer.slice(0, idx));
      buffer = buffer.slice(idx + 2);
    }
  }
  if (buffer.trim()) handle(buffer);

  if (errorMessage) throw new Error(errorMessage);
  if (!report) throw new Error('Report generation ended without a result');
  return report;
}

export const api = {
  listLeads: () => request<Lead[]>('/leads'),
  getLead: (id: string) => request<{ lead: Lead; reports: Report[] }>(`/leads/${id}`),
  createLead: (lead: Partial<Lead>) =>
    request<Lead>('/leads', { method: 'POST', body: JSON.stringify(lead) }),
  updateLead: (id: string, lead: Partial<Lead>) =>
    request<Lead>(`/leads/${id}`, { method: 'PUT', body: JSON.stringify(lead) }),
  importLeads: (leads: Array<Partial<Lead>>) =>
    request<{ imported: number; skipped: number }>('/leads/import', {
      method: 'POST',
      body: JSON.stringify({ leads }),
    }),
  generateReport: (input: { leadId: string; focus: string; template: string; sections: string[] }) =>
    request<Report>('/reports/generate', { method: 'POST', body: JSON.stringify(input) }),
  markReportSent: (id: string) => request<Report>(`/reports/${id}/mark-sent`, { method: 'POST' }),
  reportStats: () => request<{ total: number; sentThisMonth: number }>('/reports/stats'),
  getSettings: () => request<AppSettings>('/settings'),
  updateSettings: (s: Partial<AppSettings>) =>
    request<AppSettings>('/settings', { method: 'PUT', body: JSON.stringify(s) }),
  // Senders + team (multi-tenant; not scoped by the header)
  listSenders: () => request<Sender[]>('/senders'),
  createSender: (s: Partial<Sender> & { name: string }) =>
    request<Sender>('/senders', { method: 'POST', body: JSON.stringify(s) }),
  updateSender: (id: string, s: Partial<Sender>) =>
    request<Sender>(`/senders/${id}`, { method: 'PUT', body: JSON.stringify(s) }),
  listTeam: (senderId: string) => request<TeamMember[]>(`/senders/${senderId}/team`),
  addTeamMember: (senderId: string, m: Partial<TeamMember> & { name: string }) =>
    request<TeamMember>(`/senders/${senderId}/team`, { method: 'POST', body: JSON.stringify(m) }),
  updateTeamMember: (senderId: string, memberId: string, m: Partial<TeamMember>) =>
    request<TeamMember>(`/senders/${senderId}/team/${memberId}`, { method: 'PUT', body: JSON.stringify(m) }),
  deleteTeamMember: async (senderId: string, memberId: string) => {
    const res = await fetch(`/api/senders/${senderId}/team/${memberId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
  },
};
