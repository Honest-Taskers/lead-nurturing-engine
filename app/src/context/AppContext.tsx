import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { AppSettings, Lead, Report } from '../data/types';
import { api } from '../api/client';

/**
 * App store backed by the Express + MySQL API (server/).
 * All reads/mutations go through these methods so pages stay decoupled from transport.
 */
interface AppContextValue {
  authed: boolean;
  login: (email: string) => void;
  logout: () => void;
  ready: boolean;
  apiError: string | null;
  leads: Lead[];
  reports: Report[]; // accumulated cache of loaded reports
  reportStats: { total: number; sentThisMonth: number };
  settings: AppSettings;
  getLead: (id: string) => Lead | undefined;
  reportsForLead: (leadId: string) => Report[];
  loadReportsForLead: (leadId: string) => Promise<void>;
  saveLead: (lead: Partial<Lead> & { id?: string }) => Promise<Lead>;
  importLeads: (rows: Array<Partial<Lead>>) => Promise<{ imported: number; skipped: number }>;
  generateReport: (
    leadId: string,
    opts: { focus: string; template: string; sections: string[] },
  ) => Promise<Report>;
  markAsSent: (reportId: string) => Promise<void>;
  saveSettings: (s: Partial<AppSettings>) => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

const AUTH_KEY = 're-authed';

const FALLBACK_SETTINGS: AppSettings = {
  companyName: 'Honest Taskers',
  defaultRep: 'Jaya',
  cadenceDays: 14,
  defaultSections: [
    'Industry overview',
    'Key 2026 trends',
    'Top publications to follow',
    'Hiring / talent insight',
    'How Honest Taskers helps',
  ],
  aiPrompt: '',
  aiModel: 'claude-opus-5',
  apiKeyConfigured: false,
};

function mergeReports(existing: Report[], incoming: Report[]): Report[] {
  const byId = new Map(existing.map((r) => [r.id, r]));
  incoming.forEach((r) => byId.set(r.id, r));
  return [...byId.values()];
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState(() => localStorage.getItem(AUTH_KEY) === '1');
  const [ready, setReady] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [reportStats, setReportStats] = useState({ total: 0, sentThisMonth: 0 });
  const [settings, setSettings] = useState<AppSettings>(FALLBACK_SETTINGS);

  const refresh = useCallback(async () => {
    try {
      const [leadsData, settingsData, stats] = await Promise.all([
        api.listLeads(),
        api.getSettings(),
        api.reportStats(),
      ]);
      setLeads(leadsData);
      setSettings(settingsData);
      setReportStats(stats);
      setApiError(null);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Could not reach the API');
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (authed) void refresh();
    else setReady(true);
  }, [authed, refresh]);

  const login = useCallback((_email: string) => {
    localStorage.setItem(AUTH_KEY, '1');
    setAuthed(true);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(AUTH_KEY);
    setAuthed(false);
  }, []);

  const getLead = useCallback((id: string) => leads.find((l) => l.id === id), [leads]);

  const reportsForLead = useCallback(
    (leadId: string) =>
      reports
        .filter((r) => r.leadId === leadId)
        .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt)),
    [reports],
  );

  const loadReportsForLead = useCallback(async (leadId: string) => {
    const { lead, reports: leadReports } = await api.getLead(leadId);
    setLeads((ls) => ls.map((l) => (l.id === lead.id ? lead : l)));
    setReports((rs) => mergeReports(rs, leadReports));
  }, []);

  const saveLead = useCallback(async (partial: Partial<Lead> & { id?: string }): Promise<Lead> => {
    const saved = partial.id
      ? await api.updateLead(partial.id, partial)
      : await api.createLead(partial);
    setLeads((ls) => {
      const exists = ls.some((l) => l.id === saved.id);
      return exists ? ls.map((l) => (l.id === saved.id ? saved : l)) : [saved, ...ls];
    });
    return saved;
  }, []);

  const importLeads = useCallback(
    async (rows: Array<Partial<Lead>>) => {
      const result = await api.importLeads(rows);
      setLeads(await api.listLeads());
      return result;
    },
    [],
  );

  const generateReport = useCallback(
    async (leadId: string, opts: { focus: string; template: string; sections: string[] }) => {
      const report = await api.generateReport({ leadId, ...opts });
      setReports((rs) => mergeReports(rs, [report]));
      setReportStats((s) => ({ ...s, total: s.total + 1 }));
      return report;
    },
    [],
  );

  const markAsSent = useCallback(async (reportId: string) => {
    const report = await api.markReportSent(reportId);
    setReports((rs) => mergeReports(rs, [report]));
    setReportStats((s) => ({ ...s, sentThisMonth: s.sentThisMonth + 1 }));
    const { lead } = await api.getLead(report.leadId);
    setLeads((ls) => ls.map((l) => (l.id === lead.id ? lead : l)));
  }, []);

  const saveSettings = useCallback(async (s: Partial<AppSettings>) => {
    setSettings(await api.updateSettings(s));
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      authed,
      login,
      logout,
      ready,
      apiError,
      leads,
      reports,
      reportStats,
      settings,
      getLead,
      reportsForLead,
      loadReportsForLead,
      saveLead,
      importLeads,
      generateReport,
      markAsSent,
      saveSettings,
    }),
    [authed, login, logout, ready, apiError, leads, reports, reportStats, settings, getLead, reportsForLead, loadReportsForLead, saveLead, importLeads, generateReport, markAsSent, saveSettings],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
