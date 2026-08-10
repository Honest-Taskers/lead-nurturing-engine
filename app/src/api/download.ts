/**
 * Triggers a browser download for an in-memory blob.
 *
 * Two details matter and are easy to get wrong: the anchor must be in the
 * document for the click to register reliably, and the object URL must NOT be
 * revoked synchronously after clicking — the browser reads the blob
 * asynchronously, so an immediate revoke silently aborts large downloads.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
