import type { Meta, StoryObj } from '@storybook/react';
import { categorical } from '@/design-system/tokens';
import { Swatch } from './Swatch';

const meta: Meta<typeof Swatch> = { title: 'Atoms/Swatch', component: Swatch, args: { color: categorical.dark[0] } };
export default meta;
type Story = StoryObj<typeof Swatch>;

export const Dot: Story = {};
export const CategoricalPalette: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: 12 }}>
      {(['dot', 'square', 'line'] as const).map((shape) => (
        <div key={shape} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {categorical.dark.map((c) => <Swatch key={c} color={c} shape={shape} />)}
        </div>
      ))}
    </div>
  ),
};
