import { describe, it, expect } from 'vitest';
import { buildPalette, darken, lighten, mix, DEFAULT_PRIMARY, DEFAULT_SECONDARY } from './palette.js';

describe('buildPalette', () => {
  it('reproduces the original HT report scheme exactly by default', () => {
    const pal = buildPalette();
    expect(pal).toMatchObject({
      primary: '#203667',
      primaryDeep: '#16264d',
      accent: '#F7B84A',
      accentDeep: '#E8A427',
      cream: '#FDF3DF',
      ink: '#1c1c1c',
      grey: '#e9e9e6',
      greyText: '#5c5c5a',
      white: '#ffffff',
    });
  });

  it('derives shades from custom brand colors', () => {
    const pal = buildPalette({ primary: '#0F3D2E', secondary: '#C9A227' });
    expect(pal.primary).toBe('#0F3D2E');
    expect(pal.accent).toBe('#C9A227');
    expect(pal.primaryDeep).not.toBe(pal.primary);
    expect(pal.cream.toLowerCase()).toMatch(/^#[0-9a-f]{6}$/);
    // Deep variants must actually be darker (compare summed channels).
    const sum = (hex: string) =>
      hex
        .slice(1)
        .match(/../g)!
        .reduce((a, c) => a + parseInt(c, 16), 0);
    expect(sum(pal.primaryDeep)).toBeLessThan(sum(pal.primary));
    expect(sum(pal.accentDeep)).toBeLessThan(sum(pal.accent));
    expect(sum(pal.cream)).toBeGreaterThan(sum(pal.accent));
  });

  it('falls back to defaults on invalid or missing input', () => {
    expect(buildPalette({ primary: 'navy blue', secondary: '' }).primary).toBe(DEFAULT_PRIMARY);
    expect(buildPalette({ primary: null, secondary: undefined }).accent).toBe(DEFAULT_SECONDARY);
    expect(buildPalette({ primary: '#12345' }).primary).toBe(DEFAULT_PRIMARY); // 5 digits
  });
});

describe('color math', () => {
  it('mix interpolates channels', () => {
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mix('#ff0000', '#00ff00', 0)).toBe('#ff0000');
  });

  it('darken and lighten move toward black/white', () => {
    expect(darken('#ffffff', 1)).toBe('#000000');
    expect(lighten('#000000', 1)).toBe('#ffffff');
  });
});
