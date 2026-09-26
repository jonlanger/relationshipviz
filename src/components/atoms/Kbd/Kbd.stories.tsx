import type { Meta, StoryObj } from '@storybook/react';
import { Kbd } from './Kbd';

const meta: Meta<typeof Kbd> = { title: 'Atoms/Kbd', component: Kbd, args: { children: '⌘K' } };
export default meta;
export const Default: StoryObj<typeof Kbd> = {};
