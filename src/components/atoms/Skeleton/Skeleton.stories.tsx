import type { Meta, StoryObj } from '@storybook/react';
import { Skeleton } from './Skeleton';

const meta: Meta<typeof Skeleton> = { title: 'Atoms/Skeleton', component: Skeleton };
export default meta;
export const Lines: StoryObj<typeof Skeleton> = {
  render: () => <div style={{ display: 'grid', gap: 8, width: 240 }}><Skeleton width="60%" height={18} /><Skeleton /><Skeleton width="80%" /></div>,
};
