import { createTheme } from '@mui/material/styles';

/**
 * Honest Taskers brand theme, repurposed from the Video-Brandbook for product UI.
 * Palette: HT Blue #2345ff · Sky #3e59ff · Aqua #2dd0e8 · Navy #162da1 / #1b1f3b
 * Type: Sequel Sans (brand) with Plus Jakarta Sans as the licensed-free fallback.
 */
export const brand = {
  blue: '#2345ff',
  blueInk: '#1a36b8',
  sky: '#3e59ff',
  aqua: '#2dd0e8',
  navy: '#162da1',
  sidebar: '#1b1f3b',
  surface: '#f4f4f2',
  ink: '#1c1c1c',
  muted: '#6b6b6b',
  faint: '#9a9a9a',
  line: '#dcdcdc',
  ok: '#1d9e75',
  okSoft: '#e1f5ee',
  okInk: '#0f6e56',
  warn: '#ba7517',
  warnSoft: '#faeeda',
  warnInk: '#854f0b',
  accentSoft: '#e7ebff',
};

const fontStack = [
  '"Sequel Sans"',
  '"Plus Jakarta Sans"',
  '"Segoe UI"',
  'system-ui',
  '-apple-system',
  'sans-serif',
].join(',');

export const theme = createTheme({
  palette: {
    primary: { main: brand.blue, dark: brand.blueInk, light: brand.sky, contrastText: '#ffffff' },
    secondary: { main: brand.aqua },
    success: { main: brand.ok, dark: brand.okInk, light: brand.okSoft },
    warning: { main: brand.warn, dark: brand.warnInk, light: brand.warnSoft },
    background: { default: brand.surface, paper: '#ffffff' },
    text: { primary: brand.ink, secondary: brand.muted, disabled: brand.faint },
    divider: brand.line,
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: fontStack,
    h4: { fontWeight: 700, letterSpacing: '-0.02em' },
    h5: { fontWeight: 700, letterSpacing: '-0.01em' },
    h6: { fontWeight: 600, letterSpacing: '-0.01em' },
    subtitle1: { fontWeight: 600 },
    subtitle2: { fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 600 },
    body2: { fontSize: '0.85rem' },
    caption: { color: brand.muted },
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 8 },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { border: `1px solid ${brand.line}`, borderRadius: 12 },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 6, fontWeight: 600 },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          color: brand.muted,
          fontWeight: 600,
          fontSize: '0.78rem',
          borderBottom: `1px solid ${brand.line}`,
        },
        root: { borderBottom: `1px solid #ececec`, fontSize: '0.85rem' },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { borderRadius: 8, backgroundColor: '#ffffff' },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: { borderRadius: 14 },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: { backgroundColor: brand.sidebar, fontSize: '0.75rem' },
      },
    },
  },
});
