/**
 * Primitive tokens — raw, context-free values.
 * Components must never reference these directly; they consume semantic tokens
 * (see ./semantic.ts), which map primitives onto roles per theme.
 */

export const gray = {
  0: '#ffffff',
  25: '#f8f9fa',
  50: '#f2f3f5',
  100: '#e4e6e9',
  200: '#c9ccd1',
  300: '#a6aab1',
  400: '#80858d',
  500: '#5b5f66',
  600: '#3d4045',
  700: '#2e3034',
  750: '#25272b',
  800: '#1e2023',
  850: '#18191c',
  900: '#131416',
  925: '#0f1012',
  950: '#0a0b0d',
} as const;

/** Signal — the brand accent. Chosen to sit outside every data hue. */
export const signal = {
  200: '#e6fb9c',
  300: '#d8f76a',
  400: '#c6f432',
  500: '#a6d41a',
  600: '#7fa310',
  700: '#5c7a00',
  800: '#3f5400',
} as const;

export const status = {
  good: '#0ca30c',
  warning: '#fab219',
  serious: '#ec835a',
  critical: '#d03b3b',
} as const;

/**
 * Categorical data palette. Fixed order — never cycled.
 * Validated (dataviz six-checks) against the dark surface gray.900 and white.
 */
export const categorical = {
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'],
  dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
} as const;

/** Single-hue sequential ramp (blue), light → dark. */
export const sequentialBlue = {
  100: '#cde2fb',
  200: '#9ec5f4',
  300: '#6da7ec',
  400: '#3987e5',
  500: '#256abf',
  600: '#184f95',
  700: '#0d366b',
} as const;

/**
 * Single-hue sequential ramp (orange), light → dark. The second sequential context
 * (risk) takes the categorical orange's hue so it never reads as the blue ramp.
 * Validated as an ordinal ramp on both theme canvases.
 */
export const sequentialOrange = {
  200: '#f9bd9f',
  300: '#f39a6d',
  400: '#e8773f',
  500: '#c9521f',
  600: '#9c3d14',
  700: '#6e2a0c',
} as const;

export const space = {
  0: '0px',
  px: '1px',
  0.5: '2px',
  1: '4px',
  1.5: '6px',
  2: '8px',
  2.5: '10px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  8: '32px',
  10: '40px',
  12: '48px',
  16: '64px',
  20: '80px',
} as const;

export const radius = {
  xs: '2px',
  sm: '4px',
  md: '6px',
  lg: '8px',
  xl: '12px',
  '2xl': '16px',
  full: '999px',
} as const;

export const font = {
  sans: "'Inter Variable', 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif",
  mono: "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace",
} as const;

/** Type scale: [size, line-height, letter-spacing, weight] */
export const typeScale = {
  hero: ['48px', '52px', '-0.03em', 600],
  display: ['32px', '40px', '-0.022em', 600],
  h1: ['24px', '32px', '-0.017em', 600],
  h2: ['18px', '26px', '-0.011em', 600],
  h3: ['15px', '22px', '-0.006em', 600],
  bodyLg: ['16px', '24px', '-0.006em', 400],
  body: ['14px', '20px', '-0.003em', 400],
  bodySm: ['13px', '18px', '0em', 400],
  caption: ['12px', '16px', '0em', 400],
  overline: ['11px', '14px', '0.06em', 600],
} as const;

export const fontWeight = { regular: 400, medium: 500, semibold: 600 } as const;

export const duration = {
  instant: '80ms',
  fast: '150ms',
  base: '240ms',
  slow: '400ms',
} as const;

export const easing = {
  standard: 'cubic-bezier(0.2, 0, 0, 1)',
  emphasized: 'cubic-bezier(0.3, 0, 0, 1)',
  exit: 'cubic-bezier(0.3, 0, 1, 1)',
} as const;

export const zIndex = {
  base: 0,
  raised: 1,
  sticky: 10,
  drawer: 20,
  overlay: 30,
  popover: 40,
  tooltip: 50,
  toast: 60,
} as const;

export const breakpoint = {
  sm: 640,
  md: 900,
  lg: 1200,
  xl: 1600,
} as const;
