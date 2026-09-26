import type { Meta, StoryObj } from '@storybook/react';
import { Badge } from './Badge';

const meta: Meta<typeof Badge> = { title: 'Atoms/Badge', component: Badge, args: { children: 'S&P 500' } };
export default meta;
type Story = StoryObj<typeof Badge>;

export const Neutral: Story = {};
export const Tones: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 8 }}>
      <Badge>Neutral</Badge>
      <Badge tone="accent">Curated</Badge>
      <Badge tone="good" dot>High confidence</Badge>
      <Badge tone="warning" dot>Medium</Badge>
      <Badge tone="critical" dot>Low</Badge>
    </div>
  ),
};
