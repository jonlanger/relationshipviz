import type { Meta, StoryObj } from '@storybook/react';
import { dark } from '@/design-system/tokens';
import { LensScorecard } from './LensScorecard';
import { lensIndex, lensRelationships, lensResult } from './lensFixture';

const forCompany = (id: string) => ({
  company: lensIndex.get(id)!,
  lens: lensResult.byId.get(id)!,
  relationships: lensRelationships.filter((r) => r.source === id || r.target === id),
});

const meta: Meta<typeof LensScorecard> = {
  title: 'Organisms/LensScorecard',
  component: LensScorecard,
  args: { companyIndex: lensIndex, tokens: dark, onSelectRelationship: () => {}, onHover: () => {} },
};
export default meta;
type Story = StoryObj<typeof LensScorecard>;

export const Compact: Story = {
  args: forCompany('NVDA'),
  decorators: [(S) => <div style={{ width: 340 }}><S /></div>],
};
export const Full: Story = {
  args: { ...forCompany('INTC'), variant: 'full', universe: 'all companies' },
  decorators: [(S) => <div style={{ width: 900 }}><S /></div>],
};
