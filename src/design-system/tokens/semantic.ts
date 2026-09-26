import { categorical, gray, sequentialBlue, sequentialOrange, signal, status } from './primitives';

/**
 * Semantic tokens — roles, not values. Each theme fills every role.
 * Keys become CSS custom properties: `bg.canvas` → `--color-bg-canvas`.
 */
export interface ThemeTokens {
  bg: {
    canvas: string;
    surface1: string;
    surface2: string;
    surface3: string;
    /** Elevated control surface (selected segment, thumb) — contrasts with `inset` in both themes. */
    raised: string;
    inset: string;
    hover: string;
    active: string;
    overlay: string;
    inverse: string;
  };
  text: {
    primary: string;
    secondary: string;
    tertiary: string;
    disabled: string;
    inverse: string;
    onAccent: string;
    accent: string;
  };
  border: {
    subtle: string;
    default: string;
    strong: string;
    focus: string;
  };
  accent: {
    default: string;
    hover: string;
    muted: string;
    subtle: string;
  };
  status: {
    good: string;
    warning: string;
    serious: string;
    critical: string;
    goodText: string;
    criticalText: string;
  };
  viz: {
    series: readonly string[];
    other: string;
    /** Node fill when color encodes something else (e.g. edges by relationship). */
    neutralNode: string;
    muted: string;
    dimmed: string;
    grid: string;
    axis: string;
    edge: string;
    edgeStrong: string;
    label: string;
    labelHalo: string;
    sequential: readonly string[];
    /** Ordinal 5-step ramps for lens scores, ordered low → high score (the high end is most salient). */
    risk: readonly string[];
    opportunity: readonly string[];
  };
  shadow: {
    sm: string;
    md: string;
    lg: string;
  };
}

export const dark: ThemeTokens = {
  bg: {
    canvas: gray[950],
    surface1: gray[900],
    surface2: gray[850],
    surface3: gray[800],
    raised: gray[750],
    inset: gray[925],
    hover: 'rgba(255, 255, 255, 0.05)',
    active: 'rgba(255, 255, 255, 0.08)',
    overlay: 'rgba(5, 6, 8, 0.72)',
    inverse: gray[50],
  },
  text: {
    primary: '#f4f5f6',
    secondary: gray[300],
    tertiary: gray[400],
    disabled: gray[500],
    inverse: gray[950],
    onAccent: gray[950],
    accent: signal[400],
  },
  border: {
    subtle: 'rgba(255, 255, 255, 0.06)',
    default: 'rgba(255, 255, 255, 0.10)',
    strong: 'rgba(255, 255, 255, 0.18)',
    focus: signal[400],
  },
  accent: {
    default: signal[400],
    hover: signal[300],
    muted: 'rgba(198, 244, 50, 0.16)',
    subtle: 'rgba(198, 244, 50, 0.08)',
  },
  status: {
    ...status,
    goodText: '#3fcf3f',
    criticalText: '#f07474',
  },
  viz: {
    series: categorical.dark,
    other: gray[400],
    neutralNode: gray[500],
    muted: gray[600],
    dimmed: gray[750],
    grid: 'rgba(255, 255, 255, 0.06)',
    axis: gray[600],
    edge: 'rgba(166, 170, 177, 0.22)',
    edgeStrong: 'rgba(228, 230, 233, 0.55)',
    label: gray[100],
    labelHalo: gray[950],
    sequential: [
      sequentialBlue[700],
      sequentialBlue[600],
      sequentialBlue[500],
      sequentialBlue[400],
      sequentialBlue[300],
      sequentialBlue[200],
    ],
    risk: [sequentialOrange[600], sequentialOrange[500], sequentialOrange[400], sequentialOrange[300], sequentialOrange[200]],
    opportunity: [sequentialBlue[600], sequentialBlue[500], sequentialBlue[400], sequentialBlue[300], sequentialBlue[200]],
  },
  shadow: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.4)',
    md: '0 4px 12px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.06)',
    lg: '0 16px 48px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.08)',
  },
};

export const light: ThemeTokens = {
  bg: {
    canvas: gray[25],
    surface1: gray[0],
    surface2: gray[0],
    surface3: gray[50],
    raised: gray[0],
    inset: gray[50],
    hover: 'rgba(10, 11, 13, 0.04)',
    active: 'rgba(10, 11, 13, 0.07)',
    overlay: 'rgba(10, 11, 13, 0.32)',
    inverse: gray[900],
  },
  text: {
    primary: gray[950],
    secondary: gray[500],
    tertiary: gray[400],
    disabled: gray[300],
    inverse: gray[0],
    onAccent: gray[950],
    accent: signal[800],
  },
  border: {
    subtle: 'rgba(10, 11, 13, 0.06)',
    default: 'rgba(10, 11, 13, 0.10)',
    strong: 'rgba(10, 11, 13, 0.20)',
    focus: signal[700],
  },
  accent: {
    default: signal[400],
    hover: signal[500],
    muted: 'rgba(127, 163, 16, 0.18)',
    subtle: 'rgba(127, 163, 16, 0.08)',
  },
  status: {
    ...status,
    goodText: '#006300',
    criticalText: '#b42323',
  },
  viz: {
    series: categorical.light,
    other: gray[400],
    neutralNode: gray[300],
    muted: gray[200],
    dimmed: gray[100],
    grid: 'rgba(10, 11, 13, 0.06)',
    axis: gray[200],
    edge: 'rgba(61, 64, 69, 0.14)',
    edgeStrong: 'rgba(19, 20, 22, 0.5)',
    label: gray[900],
    labelHalo: gray[0],
    sequential: [
      sequentialBlue[100],
      sequentialBlue[200],
      sequentialBlue[300],
      sequentialBlue[400],
      sequentialBlue[500],
      sequentialBlue[600],
    ],
    risk: [sequentialOrange[300], sequentialOrange[400], sequentialOrange[500], sequentialOrange[600], sequentialOrange[700]],
    opportunity: [sequentialBlue[300], sequentialBlue[400], sequentialBlue[500], sequentialBlue[600], sequentialBlue[700]],
  },
  shadow: {
    sm: '0 1px 2px rgba(10, 11, 13, 0.06)',
    md: '0 4px 12px rgba(10, 11, 13, 0.08), 0 0 0 1px rgba(10, 11, 13, 0.06)',
    lg: '0 16px 48px rgba(10, 11, 13, 0.14), 0 0 0 1px rgba(10, 11, 13, 0.06)',
  },
};

export const themes = { dark, light } as const;
export type ThemeName = keyof typeof themes;
