import type { Meta, StoryObj } from '@storybook/react';
import { categorical } from '@/design-system/tokens';
import { TickerMark } from '../../atoms';
import { StatTile } from './StatTile';

const meta: Meta<typeof StatTile> = { title: 'Molecules/StatTile', component: StatTile, decorators: [(S) => <div style={{ width: 240 }}><S /></div>] };
export default meta;
type Story = StoryObj<typeof StatTile>;
export const Number: Story = { args: { label: 'Relationships', value: '236', caption: 'across 127 companies' } };
export const Hero: Story = { args: { label: 'Companies', value: '127', emphasis: 'hero' } };
export const Entity: Story = {
  args: { label: 'Most central', value: 'Nvidia', caption: 'Bridges 18% of shortest paths', leading: <TickerMark ticker="NVDA" size="sm" color={categorical.dark[0]} />, onClick: () => {} },
};
