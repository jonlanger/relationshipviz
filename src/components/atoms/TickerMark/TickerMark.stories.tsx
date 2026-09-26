import type { Meta, StoryObj } from '@storybook/react';
import { categorical } from '@/design-system/tokens';
import { TickerMark } from './TickerMark';

const meta: Meta<typeof TickerMark> = { title: 'Atoms/TickerMark', component: TickerMark, args: { ticker: 'NVDA', color: categorical.dark[0] } };
export default meta;
type Story = StoryObj<typeof TickerMark>;

export const Default: Story = {};
export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <TickerMark ticker="AAPL" size="sm" color={categorical.dark[0]} />
      <TickerMark ticker="JPM" color={categorical.dark[3]} />
      <TickerMark ticker="BRK.B" size="lg" color={categorical.dark[4]} />
    </div>
  ),
};
