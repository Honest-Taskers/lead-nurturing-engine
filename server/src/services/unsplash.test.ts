import { describe, it, expect, beforeEach, vi } from 'vitest';

const { saveImage } = vi.hoisted(() => ({ saveImage: vi.fn(async (..._args: unknown[]) => {}) }));
vi.mock('../db/images.js', () => ({ saveImage }));

import { fetchUnsplashPhoto } from './unsplash.js';

const photo = {
  urls: { regular: 'https://images.unsplash.com/photo-1?w=1080' },
  links: { download_location: 'https://api.unsplash.com/photos/1/download' },
  user: { name: 'Jane Doe' },
};

function mockFetch(handlers: Record<string, () => Response | Promise<Response>>) {
  return vi.fn(async (url: string | URL) => {
    const key = Object.keys(handlers).find((k) => String(url).includes(k));
    if (!key) throw new Error(`unexpected fetch: ${url}`);
    return handlers[key]();
  });
}

describe('fetchUnsplashPhoto', () => {
  beforeEach(() => {
    vi.stubEnv('UNSPLASH_ACCESS_KEY', 'test-key');
    saveImage.mockClear();
  });

  it('searches, triggers the download event, stores the image and returns credit', async () => {
    const fetchMock = mockFetch({
      'api.unsplash.com/search/photos': () =>
        new Response(JSON.stringify({ results: [photo] }), { status: 200 }),
      '/photos/1/download': () => new Response('{}', { status: 200 }),
      'images.unsplash.com': () =>
        new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'content-type': 'image/jpeg' } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchUnsplashPhoto('hospital executive', 'portrait', 'cover');
    expect(result).not.toBeNull();
    expect(result!.url).toMatch(/^\/api\/images\/cover-.+\.jpg$/);
    expect(result!.credit).toBe('Jane Doe / Unsplash');
    expect(saveImage).toHaveBeenCalledTimes(1);
    // Unsplash guideline: the download_location endpoint must be pinged.
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('/photos/1/download'))).toBe(true);
    // Search request carries the access key and orientation.
    const searchCall = fetchMock.mock.calls.find(([u]) => String(u).includes('search/photos'))!;
    expect(String(searchCall[0])).toContain('orientation=portrait');
  });

  it('returns null without a key', async () => {
    vi.stubEnv('UNSPLASH_ACCESS_KEY', '');
    expect(await fetchUnsplashPhoto('anything', 'portrait', 'cover')).toBeNull();
  });

  it('returns null on a failed search', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({ 'api.unsplash.com/search/photos': () => new Response('nope', { status: 403 }) }),
    );
    expect(await fetchUnsplashPhoto('anything', 'portrait', 'cover')).toBeNull();
    expect(saveImage).not.toHaveBeenCalled();
  });

  it('returns null when the search has no results', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        'api.unsplash.com/search/photos': () => new Response(JSON.stringify({ results: [] }), { status: 200 }),
      }),
    );
    expect(await fetchUnsplashPhoto('anything', 'landscape', 'section')).toBeNull();
  });
});
