import type { AppSettings, Lead, Report } from '../data/types';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
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
};
