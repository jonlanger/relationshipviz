import type { Meta, StoryObj } from '@storybook/react';
import { dark } from '@/design-system/tokens';
import { FactorBreakdown } from './FactorBreakdown';

const meta: Meta<typeof FactorBreakdown> = {
  title: 'Molecules/FactorBreakdown',
  component: FactorBreakdown,
  decorators: [(S) => <div style={{ width: 340 }}><S /></div>],
  args: {
    color: dark.viz.risk[3],
    factors: [
      { key: 'geo', label: 'Geographic exposure', score: 0.92, contribution: 17.5, weight: 1, explain: 'Depends on TSMC in Taiwan: cross-strait tension.' },
      { key: 'sup', label: 'Supplier concentration', score: 0.79, contribution: 15, weight: 1, explain: 'Critical dependence on TSMC, SK hynix (7 suppliers in total).' },
      { key: 'comp', label: 'Competitive pressure', score: 0, contribution: 0, weight: 0.75, explain: 'Growing as fast as or faster than its 3 competitors.' },
      { key: 'fund', label: 'Weak fundamentals', score: null, contribution: 0, weight: 0.5, explain: 'No SEC financials.' },
      { key: 'inst', label: 'Relationship instability', score: 0.2, contribution: 0, weight: 0, explain: 'All ties are active.' },
    ],
  },
};
export default meta;
type Story = StoryObj<typeof FactorBreakdown>;
export const Detailed: Story = {};
export const Compact: Story = { args: { detailed: false } };
