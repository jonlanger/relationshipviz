import type { Meta, StoryObj } from '@storybook/react';
import { categorical } from '@/design-system/tokens';
import { ChartTooltip } from './ChartTooltip';

const meta: Meta<typeof ChartTooltip> = { title: 'Molecules/ChartTooltip', component: ChartTooltip, decorators: [(S) => <div style={{ position: 'relative', height: 120 }}><S /></div>] };
export default meta;
export const Default: StoryObj<typeof ChartTooltip> = {
  args: { x: 0, y: 60, title: 'Information Technology ↔ Communication Services', rows: [{ label: 'Relationships', value: 24, color: categorical.dark[0] }, { label: 'Share of total', value: '10%' }] },
};
