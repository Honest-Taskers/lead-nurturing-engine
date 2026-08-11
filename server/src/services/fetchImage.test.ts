import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchImageBuffer } from './fetchImage.js';

function mockFetchOnce(response: Partial<Response> | Error) {
  const fn =
    response instanceof Error
      ? vi.fn().mockRejectedValue(response)
      : vi.fn().mockResolvedValue(response as Response);
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer;

describe('fetchImageBuffer', () => {
  it('returns a Buffer for a healthy image response', async () => {
    mockFetchOnce({
      ok: true,
      headers: new Headers({ 'content-type': 'image/png', 'content-length': '4' }),
      arrayBuffer: async () => png,
    });
    const buf = await fetchImageBuffer('https://example.com/photo.png');
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf!.length).toBe(4);
  });

  it('returns null for non-image content types (hotlink-blocked HTML pages)', async () => {
    mockFetchOnce({
      ok: true,
      headers: new Headers({ 'content-type': 'text/html' }),
      arrayBuffer: async () => png,
    });
    expect(await fetchImageBuffer('https://example.com/blocked')).toBeNull();
  });

  it('returns null on HTTP errors, network failures and oversize payloads', async () => {
    mockFetchOnce({ ok: false, headers: new Headers() });
    expect(await fetchImageBuffer('https://example.com/404.png')).toBeNull();

    mockFetchOnce(new Error('network down'));
    expect(await fetchImageBuffer('https://example.com/x.png')).toBeNull();

    mockFetchOnce({
      ok: true,
      headers: new Headers({ 'content-type': 'image/jpeg', 'content-length': '9999999' }),
      arrayBuffer: async () => png,
    });
    expect(await fetchImageBuffer('https://example.com/huge.jpg')).toBeNull();
  });

  it('returns null for missing or non-http URLs without calling fetch', async () => {
    const fn = mockFetchOnce(new Error('should not be called'));
    expect(await fetchImageBuffer(null)).toBeNull();
    expect(await fetchImageBuffer('data:image/png;base64,AAAA')).toBeNull();
    expect(fn).not.toHaveBeenCalled();
  });
});
