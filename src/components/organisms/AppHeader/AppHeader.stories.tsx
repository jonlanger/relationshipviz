import type { Meta, StoryObj } from '@storybook/react';
import { AppHeader } from './AppHeader';

const meta: Meta<typeof AppHeader> = { title: 'Organisms/AppHeader', component: AppHeader, parameters: { layout: 'fullscreen' } };
export default meta;
export const Default: StoryObj<typeof AppHeader> = {
  args: { searchItems: [{ id: 'NVDA', ticker: 'NVDA', label: 'Nvidia' }], onSearchSelect: () => {}, theme: 'dark', onToggleTheme: () => {} },
};
