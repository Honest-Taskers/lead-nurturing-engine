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
