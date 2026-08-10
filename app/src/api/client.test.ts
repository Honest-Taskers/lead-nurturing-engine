import { describe, it, expect, vi, afterEach } from 'vitest';
import { api } from './client';

function mockFetch(response: { ok: boolean; status?: number; json: () => Promise<unknown> }) {
  const fn = vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('api client', () => {
  it('calls relative /api paths with JSON headers', async () => {
    const fetchMock = mockFetch({ ok: true, json: async () => [] });
    await api.listLeads();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/leads',
      expect.objectContaining({ headers: { 'Content-Type': 'application/json' } }),
    );
  });

  it('surfaces the server error message on failure', async () => {
    mockFetch({ ok: false, status: 404, json: async () => ({ error: 'Lead not found' }) });
    await expect(api.getLead('nope')).rejects.toThrow('Lead not found');
  });

  it('falls back to a status message when the error body is not JSON', async () => {
    mockFetch({ ok: false, status: 500, json: async () => { throw new Error('not json'); } });
    await expect(api.listLeads()).rejects.toThrow('Request failed (500)');
  });
});
