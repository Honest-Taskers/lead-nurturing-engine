/**
 * Company logos come from logo.dev, which serves them by domain:
 *   https://img.logo.dev/commonspirit.org?token=pk_...
 *
 * We store the resolved URL on the lead (lne_leads.logo_url) rather than the
 * image bytes, so logos stay current. LOGO_DEV_TOKEN is a publishable token —
 * it is meant to be visible in URLs the browser loads.
 */

/** "https://www.commonspirit.org/about" → "commonspirit.org" */
export function domainFromWebsite(website?: string | null): string | null {
  const trimmed = website?.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const host = new URL(withScheme).hostname.toLowerCase().replace(/^www\./, '');
    // Reject anything that isn't a plausible domain (e.g. a bare company name).
    return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host) ? host : null;
  } catch {
    return null;
  }
}

/** Canonical, token-free URL — what gets stored on the lead. */
export function logoUrlForWebsite(website?: string | null): string | null {
  const domain = domainFromWebsite(website);
  if (!domain) return null;
  return `https://img.logo.dev/${domain}?size=128&format=png`;
}

/**
 * Adds the publishable token as the lead leaves the API. logo.dev answers 401
 * without one, but keeping the token out of stored URLs means rotating it
 * needs no data migration. Custom logo URLs are passed through untouched.
 */
export function withLogoToken(url?: string | null): string | null {
  if (!url) return null;
  const token = process.env.LOGO_DEV_TOKEN;
  if (!token || !url.includes('img.logo.dev') || url.includes('token=')) return url;
  return `${url}${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
}
