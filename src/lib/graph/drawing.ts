import type { Attributes } from 'graphology-types';
import type { NodeHoverDrawingFunction, NodeLabelDrawingFunction } from 'sigma/rendering';
import type { ThemeTokens } from '@/design-system/tokens';
import { font } from '@/design-system/tokens';

const LABEL_SIZE = 12;

/** Canvas label with a halo in the canvas color, so labels stay legible over edges. */
export function makeLabelRenderer<N extends Attributes, E extends Attributes>(t: ThemeTokens): NodeLabelDrawingFunction<N, E> {
  return (ctx, data) => {
    if (!data.label) return;
    const weight = (data as { forceLabel?: boolean }).forceLabel ? 600 : 500;
    ctx.font = `${weight} ${LABEL_SIZE}px ${font.sans}`;
    ctx.textBaseline = 'middle';
    const x = data.x + data.size + 4;
    const y = data.y;
    ctx.lineJoin = 'round';
    ctx.lineWidth = 4;
    ctx.strokeStyle = t.viz.labelHalo;
    ctx.strokeText(data.label, x, y);
    ctx.fillStyle = t.viz.label;
    ctx.fillText(data.label, x, y);
  };
}

/** Hover card: a pill with the label, drawn in the surface color with a hairline border. */
export function makeHoverRenderer<N extends Attributes, E extends Attributes>(t: ThemeTokens): NodeHoverDrawingFunction<N, E> {
  return (ctx, data) => {
    if (!data.label) return;
    ctx.font = `600 ${LABEL_SIZE}px ${font.sans}`;
    const textW = ctx.measureText(data.label).width;
    const padX = 8;
    const h = 22;
    const x = data.x + data.size + 4;
    const y = data.y - h / 2;
    const w = textW + padX * 2;

    // Ring around the node.
    ctx.beginPath();
    ctx.arc(data.x, data.y, data.size + 3, 0, Math.PI * 2);
    ctx.strokeStyle = t.text.primary;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 6);
    ctx.fillStyle = t.bg.surface2;
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = t.border.strong;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = t.text.primary;
    ctx.textBaseline = 'middle';
    ctx.fillText(data.label, x + padX, data.y);
  };
}

/** Append an alpha channel to a #rrggbb color. */
export function withAlpha(hex: string, alpha: number): string {
  if (!hex.startsWith('#') || hex.length !== 7) return hex;
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255).toString(16).padStart(2, '0');
  return `${hex}${a}`;
}

function parse(c: string): [number, number, number, number] {
  const m = c.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\)/);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] != null ? Number(m[4]) : 1];
  const h = c.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1];
}

/**
 * Sigma's WebGL edges don't composite alpha like CSS does, so translucent colors read as
 * near-opaque on dark canvases. Pre-blend against the canvas color instead.
 * `alpha` overrides any alpha already in `color`.
 */
export function flatten(color: string, background: string, alpha?: number): string {
  const [r, g, b, a0] = parse(color);
  const [br, bg, bb] = parse(background);
  const a = alpha ?? a0;
  const mix = (f: number, k: number) => Math.round(f * a + k * (1 - a));
  return `#${[mix(r, br), mix(g, bg), mix(b, bb)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
