import type { Meta, StoryObj } from '@storybook/react';
import { categorical } from '@/design-system/tokens';
import { Legend } from './Legend';

const meta: Meta<typeof Legend> = { title: 'Molecules/Legend', component: Legend };
export default meta;
type Story = StoryObj<typeof Legend>;
const entries = ['Supplier', 'Partner', 'Investor', 'Competitor'].map((l, i) => ({ key: l, label: l, color: categorical.dark[i], value: 40 - i * 8 }));
export const Vertical: Story = { args: { title: 'Relationship', entries }, decorators: [(S) => <div style={{ width: 200 }}><S /></div>] };
export const Horizontal: Story = { args: { entries, orientation: 'horizontal', shape: 'line' } };
