import { randomUUID } from 'node:crypto';
import { saveImage } from '../db/images.js';
import { fetchImageBuffer } from './fetchImage.js';

export interface UnsplashPhoto {
  /** Served from our own image store, e.g. /api/images/cover-<uuid>.jpg */
  url: string;
  /** Attribution required by the Unsplash API guidelines, e.g. "Jane Doe / Unsplash". */
  credit: string;
}

interface UnsplashSearchResult {
  results: Array<{
    urls: { regular: string };
    links: { download_location: string };
    user: { name: string };
  }>;
}

/**
 * Search Unsplash for a photo, trigger the download event (required by the
 * Unsplash API guidelines), store the image in our BLOB store and return its
 * local URL plus the photographer credit. Fail-soft: any failure returns null
 * so the PDF falls back to the generated burst cover.
 */
export async function fetchUnsplashPhoto(
  query: string,
  orientation: 'portrait' | 'landscape',
  filePrefix: string,
  /** Pick the nth search result (used to guarantee a DIFFERENT photo when two images share a query). */
  resultIndex = 0,
): Promise<UnsplashPhoto | null> {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey || !query.trim()) return null;
  const auth = { Authorization: `Client-ID ${accessKey}` };
  try {
    const params = new URLSearchParams({
      query,
      orientation,
      per_page: '5',
      content_filter: 'high',
    });
    const res = await fetch(`https://api.unsplash.com/search/photos?${params}`, { headers: auth });
    if (!res.ok) {
      console.warn(`unsplash search failed (${res.status}) for "${query}"`);
      return null;
    }
    const data = (await res.json()) as UnsplashSearchResult;
    const results = data.results ?? [];
    const photo = results[Math.min(resultIndex, results.length - 1)];
    if (!photo) return null;

    // Unsplash guidelines: report the download when the photo is actually used.
    fetch(photo.links.download_location, { headers: auth }).catch(() => {});

    const buf = await fetchImageBuffer(photo.urls.regular, { maxBytes: 5_000_000, timeoutMs: 10_000 });
    if (!buf) return null;

    const filename = `${filePrefix}-${randomUUID()}.jpg`;
    await saveImage(filename, 'image/jpeg', buf);
    return { url: `/api/images/${filename}`, credit: `${photo.user.name} / Unsplash` };
  } catch (err) {
    console.warn('unsplash fetch failed (continuing without photo):', err);
    return null;
  }
}
