import type { Meta, StoryObj } from '@storybook/react';
import { BrandMark } from './BrandMark';

const meta: Meta<typeof BrandMark> = { title: 'Atoms/BrandMark', component: BrandMark };
export default meta;
export const Sizes: StoryObj<typeof BrandMark> = {
  render: () => <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}><BrandMark size={16} /><BrandMark /><BrandMark size={40} /></div>,
};
