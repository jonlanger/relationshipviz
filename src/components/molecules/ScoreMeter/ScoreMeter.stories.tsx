import type { Meta, StoryObj } from '@storybook/react';
import { dark } from '@/design-system/tokens';
import { ScoreMeter } from './ScoreMeter';

const meta: Meta<typeof ScoreMeter> = {
  title: 'Molecules/ScoreMeter',
  component: ScoreMeter,
  args: { label: 'Risk', score: 72, percentile: 0.86, color: dark.viz.risk[4] },
  decorators: [(S) => <div style={{ width: 220 }}><S /></div>],
};
export default meta;
type Story = StoryObj<typeof ScoreMeter>;
export const Risk: Story = {};
export const Opportunity: Story = { args: { label: 'Opportunity', score: 41, percentile: 0.38, color: dark.viz.opportunity[1] } };
export const Small: Story = { args: { size: 'sm', note: 'Limited data' } };
