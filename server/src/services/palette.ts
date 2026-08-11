/**
 * Report palette derived from a sender's two brand colors. The defaults
 * reproduce the original Honest Taskers report scheme (navy + warm gold)
 * exactly, so senders without brand colors get today's design unchanged.
 */

export interface Palette {
  /** Brand primary — page fields, headings, footers (was navy #203667). */
  primary: string;
  /** Darkened primary — full-bleed backgrounds (was #16264d). */
  primaryDeep: string;
  /** Brand secondary/accent — panels, numerals, rules (was gold #F7B84A). */
  accent: string;
  /** Darkened accent — halftone dots, chart bars (was #E8A427). */
  accentDeep: string;
  /** Near-white tint of the accent — soft panel fills (was cream #FDF3DF). */
  cream: string;
  ink: string;
  grey: string;
  greyText: string;
  white: string;
}

export const DEFAULT_PRIMARY = '#203667';
export const DEFAULT_SECONDARY = '#F7B84A';

function clamp255(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function parseHex(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const v = parseInt(m[1], 16);
  return [(v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
}

function toHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((c) => clamp255(c).toString(16).padStart(2, '0')).join('')}`;
}

/** Mixes two colors: t=0 → a, t=1 → b. */
export function mix(a: string, b: string, t: number): string {
  const ca = parseHex(a);
  const cb = parseHex(b);
  if (!ca || !cb) return a;
  return toHex([ca[0] + (cb[0] - ca[0]) * t, ca[1] + (cb[1] - ca[1]) * t, ca[2] + (cb[2] - ca[2]) * t] as [
    number,
    number,
    number,
  ]);
}

export function darken(hex: string, amount: number): string {
  return mix(hex, '#000000', amount);
}

export function lighten(hex: string, amount: number): string {
  return mix(hex, '#ffffff', amount);
}

export function buildPalette(input?: { primary?: string | null; secondary?: string | null }): Palette {
  const primary = input?.primary && parseHex(input.primary) ? input.primary : DEFAULT_PRIMARY;
  const accent = input?.secondary && parseHex(input.secondary) ? input.secondary : DEFAULT_SECONDARY;
  const isDefault = primary === DEFAULT_PRIMARY && accent === DEFAULT_SECONDARY;
  return {
    primary,
    // The hand-tuned HT shades don't sit exactly on a linear darken/tint of the
    // brand hexes, so the default palette pins them; derived palettes come close.
    primaryDeep: isDefault ? '#16264d' : darken(primary, 0.28),
    accent,
    accentDeep: isDefault ? '#E8A427' : darken(accent, 0.16),
    cream: isDefault ? '#FDF3DF' : mix(accent, '#ffffff', 0.85),
    ink: '#1c1c1c',
    grey: '#e9e9e6',
    greyText: '#5c5c5a',
    white: '#ffffff',
  };
}
