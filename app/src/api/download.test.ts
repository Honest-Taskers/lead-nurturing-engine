import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { downloadBlob } from './download';

describe('downloadBlob', () => {
  let createdUrl: string;
  let revoke: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    createdUrl = 'blob:mock-url';
    revoke = vi.fn();
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => createdUrl),
      revokeObjectURL: revoke,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('clicks an anchor that is attached to the document, then removes it', () => {
    const clicks: Array<{ href: string; download: string; attached: boolean }> = [];
    const originalClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function mockClick(this: HTMLAnchorElement) {
      clicks.push({ href: this.href, download: this.download, attached: this.isConnected });
    };

    try {
      downloadBlob(new Blob(['pdf bytes']), 'my-report.pdf');
    } finally {
      HTMLAnchorElement.prototype.click = originalClick;
    }

    expect(clicks).toEqual([{ href: createdUrl, download: 'my-report.pdf', attached: true }]);
    expect(document.querySelector('a')).toBeNull();
  });

  it('does not revoke the object URL synchronously (that aborts large downloads)', () => {
    downloadBlob(new Blob(['pdf bytes']), 'my-report.pdf');
    expect(revoke).not.toHaveBeenCalled();

    vi.runAllTimers();
    expect(revoke).toHaveBeenCalledWith(createdUrl);
  });
});
