/**
 * Fail-soft fetch for external images (recipient photos, company logos)
 * embedded in PDFs. Any failure — timeout, non-image response, oversize,
 * network error — returns null so the template falls back gracefully.
 */
export async function fetchImageBuffer(
  url: string | null | undefined,
  { timeoutMs = 5000, maxBytes = 3_000_000 }: { timeoutMs?: number; maxBytes?: number } = {},
): Promise<Buffer | null> {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: 'follow' });
    if (!res.ok) return null;
    const type = res.headers.get('content-type') ?? '';
    if (!type.startsWith('image/')) return null;
    const length = Number(res.headers.get('content-length') ?? 0);
    if (length > maxBytes) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length === 0 || bytes.length > maxBytes) return null;
    return bytes;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
