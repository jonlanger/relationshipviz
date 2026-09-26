import type { Meta, StoryObj } from '@storybook/react';
import { Sparkbars } from './Sparkbars';

const meta: Meta<typeof Sparkbars> = { title: 'Atoms/Sparkbars', component: Sparkbars };
export default meta;
type Story = StoryObj<typeof Sparkbars>;
export const Growth: Story = { args: { values: [16.7, 26.9, 27, 60.9, 130.5, 215.9], label: 'Nvidia revenue FY2021–FY2026' } };
export const WithLoss: Story = { args: { values: [42.5, 89.9, -22.8, 96.2, 89, 67], label: 'Berkshire net income 2020–2025', color: 'var(--viz-series-2)' } };
