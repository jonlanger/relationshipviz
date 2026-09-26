import type { Meta, StoryObj } from '@storybook/react';
import { categorical } from '@/design-system/tokens';
import { ConnectionRow } from './ConnectionRow';

const meta: Meta<typeof ConnectionRow> = {
  title: 'Molecules/ConnectionRow', component: ConnectionRow,
  args: { ticker: 'AAPL', name: 'Apple', relation: 'Supplies', direction: 'out', weight: 0.95, color: categorical.dark[0] },
  decorators: [(S) => <div style={{ width: 320, padding: 8 }}><S /></div>],
};
export default meta;
type Story = StoryObj<typeof ConnectionRow>;
export const Outgoing: Story = {};
export const Incoming: Story = { args: { direction: 'in', relation: 'Supplied by', weight: 0.4 } };
export const Symmetric: Story = { args: { direction: 'both', relation: 'Competes with', weight: 0.7, lowConfidence: true } };
