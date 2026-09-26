import type { Meta, StoryObj } from '@storybook/react';
import { Search } from 'lucide-react';
import { Kbd } from '../Kbd';
import { Input } from './Input';

const meta: Meta<typeof Input> = { title: 'Atoms/Input', component: Input, args: { placeholder: 'Search companies…' } };
export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {};
export const WithIcon: Story = { args: { leadingIcon: Search, trailing: <Kbd>/</Kbd> } };
export const Invalid: Story = { args: { invalid: true, defaultValue: 'ZZZZ' } };
export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: 8, width: 280 }}>
      <Input size="sm" placeholder="Small" /><Input placeholder="Medium" /><Input size="lg" placeholder="Large" />
    </div>
  ),
};
