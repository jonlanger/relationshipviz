import type { Meta, StoryObj } from '@storybook/react';
import { Spinner } from './Spinner';

const meta: Meta<typeof Spinner> = { title: 'Atoms/Spinner', component: Spinner };
export default meta;
export const Sizes: StoryObj<typeof Spinner> = {
  render: () => <div style={{ display: 'flex', gap: 16 }}><Spinner size="sm" /><Spinner /><Spinner size="lg" label="Loading" /></div>,
};
