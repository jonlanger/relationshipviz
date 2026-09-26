import type { Meta, StoryObj } from '@storybook/react';
import { Checkbox } from './Checkbox';

const meta: Meta<typeof Checkbox> = { title: 'Atoms/Checkbox', component: Checkbox, args: { label: 'Show labels' } };
export default meta;
type Story = StoryObj<typeof Checkbox>;

export const Default: Story = {};
export const Checked: Story = { args: { defaultChecked: true, trailing: '42' } };
export const Indeterminate: Story = { args: { indeterminate: true, label: 'All sectors' } };
export const Disabled: Story = { args: { disabled: true } };
