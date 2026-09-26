import type { Meta, StoryObj } from '@storybook/react';
import { categorical, radius, sequentialBlue, space, typeScale } from '../tokens';
import { useTheme } from '../useTheme';

const meta: Meta = { title: 'Foundations/Tokens', parameters: { layout: 'padded' } };
export default meta;

const label: React.CSSProperties = { fontSize: 12, color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)' };
const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section style={{ display: 'grid', gap: 12, marginBottom: 40 }}>
    <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-text-primary)' }}>{title}</h2>
    {children}
  </section>
);
const Chip = ({ color, name }: { color: string; name: string }) => (
  <div style={{ display: 'grid', gap: 6, width: 112 }}>
    <div style={{ height: 48, borderRadius: 8, background: color, boxShadow: 'inset 0 0 0 1px var(--color-border-default)' }} />
    <span style={{ ...label, color: 'var(--color-text-secondary)' }}>{name}</span>
    <span style={label}>{color}</span>
  </div>
);

export const Surfaces: StoryObj = {
  render: function Render() {
    const { tokens } = useTheme();
    return (
      <>
        <Section title="Backgrounds">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
            {Object.entries(tokens.bg).map(([k, v]) => <Chip key={k} name={`bg.${k}`} color={v} />)}
          </div>
        </Section>
        <Section title="Text">
          {Object.entries(tokens.text).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', gap: 16, alignItems: 'baseline' }}>
              <span style={{ color: v, fontSize: 16, width: 280, background: k === 'inverse' || k === 'onAccent' ? tokens.bg.inverse : undefined }}>The network holds together</span>
              <span style={label}>text.{k} · {v}</span>
            </div>
          ))}
        </Section>
        <Section title="Accent & status">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
            {Object.entries({ ...tokens.accent, ...tokens.status }).map(([k, v]) => <Chip key={k} name={k} color={v} />)}
          </div>
        </Section>
      </>
    );
  },
};

export const DataViz: StoryObj = {
  render: function Render() {
    const { name } = useTheme();
    return (
      <>
        <Section title="Categorical — fixed order, validated for CVD separation">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
            {categorical[name].map((c, i) => <Chip key={c} name={`series ${i + 1}`} color={c} />)}
          </div>
        </Section>
        <Section title="Sequential (blue)">
          <div style={{ display: 'flex', gap: 2 }}>
            {Object.entries(sequentialBlue).map(([k, v]) => (
              <div key={k} style={{ flex: 1, display: 'grid', gap: 6 }}>
                <div style={{ height: 40, background: v }} />
                <span style={label}>{k}</span>
              </div>
            ))}
          </div>
        </Section>
      </>
    );
  },
};

export const Typography: StoryObj = {
  render: () => (
    <Section title="Type scale">
      {Object.entries(typeScale).map(([k, [size, lh, ls, w]]) => (
        <div key={k} style={{ display: 'grid', gridTemplateColumns: '160px 1fr', alignItems: 'baseline', gap: 24 }}>
          <span style={label}>{k} · {size}/{lh}</span>
          <span style={{ fontSize: size, lineHeight: lh, letterSpacing: ls, fontWeight: w, color: 'var(--color-text-primary)', textTransform: k === 'overline' ? 'uppercase' : undefined }}>
            Supply chains span the globe
          </span>
        </div>
      ))}
    </Section>
  ),
};

export const SpacingAndRadius: StoryObj = {
  render: () => (
    <>
      <Section title="Spacing (4px base)">
        {Object.entries(space).filter(([k]) => k !== 'px').map(([k, v]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ ...label, width: 80 }}>space-{k}</span>
            <div style={{ width: v, height: 12, background: 'var(--color-accent-default)', borderRadius: 2 }} />
            <span style={label}>{v}</span>
          </div>
        ))}
      </Section>
      <Section title="Radius">
        <div style={{ display: 'flex', gap: 16 }}>
          {Object.entries(radius).map(([k, v]) => (
            <div key={k} style={{ display: 'grid', gap: 6, justifyItems: 'center' }}>
              <div style={{ width: 56, height: 56, borderRadius: v, background: 'var(--color-bg-surface-2)', border: '1px solid var(--color-border-strong)' }} />
              <span style={label}>{k}</span>
            </div>
          ))}
        </div>
      </Section>
    </>
  ),
};
