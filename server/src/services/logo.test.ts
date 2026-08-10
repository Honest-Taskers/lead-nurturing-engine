import { describe, it, expect, vi } from 'vitest';
import { domainFromWebsite, logoUrlForWebsite, withLogoToken } from './logo.js';

describe('domainFromWebsite', () => {
  it('strips scheme, www and path', () => {
    expect(domainFromWebsite('https://www.commonspirit.org/about')).toBe('commonspirit.org');
  });

  it('accepts a bare domain', () => {
    expect(domainFromWebsite('hcahealthcare.com')).toBe('hcahealthcare.com');
  });

  it('keeps subdomains other than www', () => {
    expect(domainFromWebsite('https://about.ascension.org')).toBe('about.ascension.org');
  });

  it('returns null for blank or non-domain values', () => {
    expect(domainFromWebsite(null)).toBeNull();
    expect(domainFromWebsite('   ')).toBeNull();
    expect(domainFromWebsite('CommonSpirit Health')).toBeNull();
  });
});

describe('logoUrlForWebsite', () => {
  it('builds a token-free URL for storage', () => {
    expect(logoUrlForWebsite('https://www.commonspirit.org')).toBe(
      'https://img.logo.dev/commonspirit.org?size=128&format=png',
    );
  });

  it('returns null when there is no usable domain', () => {
    expect(logoUrlForWebsite(undefined)).toBeNull();
  });
});

describe('withLogoToken', () => {
  it('appends the publishable token when one is configured', () => {
    vi.stubEnv('LOGO_DEV_TOKEN', 'pk_test123');
    expect(withLogoToken('https://img.logo.dev/commonspirit.org?size=128')).toBe(
      'https://img.logo.dev/commonspirit.org?size=128&token=pk_test123',
    );
    vi.unstubAllEnvs();
  });

  it('leaves the URL alone without a token, and passes custom URLs through', () => {
    vi.stubEnv('LOGO_DEV_TOKEN', '');
    expect(withLogoToken('https://img.logo.dev/x?size=128')).toBe('https://img.logo.dev/x?size=128');
    vi.stubEnv('LOGO_DEV_TOKEN', 'pk_test123');
    expect(withLogoToken('https://cdn.example.com/logo.png')).toBe('https://cdn.example.com/logo.png');
    vi.unstubAllEnvs();
  });

  it('does not double-append a token that is already present', () => {
    vi.stubEnv('LOGO_DEV_TOKEN', 'pk_test123');
    const url = 'https://img.logo.dev/x?token=pk_existing';
    expect(withLogoToken(url)).toBe(url);
    vi.unstubAllEnvs();
  });

  it('returns null for a lead with no logo', () => {
    expect(withLogoToken(null)).toBeNull();
  });
});
