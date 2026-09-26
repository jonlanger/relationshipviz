import type { Meta, StoryObj } from '@storybook/react';
import { ZoomIn, Maximize2, Sun } from 'lucide-react';
import { IconButton } from './IconButton';

const meta: Meta<typeof IconButton> = { title: 'Atoms/IconButton', component: IconButton, args: { icon: ZoomIn, label: 'Zoom in' } };
export default meta;
type Story = StoryObj<typeof IconButton>;

export const Ghost: Story = {};
export const Secondary: Story = { args: { variant: 'secondary', icon: Maximize2, label: 'Fit to screen' } };
export const Active: Story = { args: { active: true, icon: Sun, label: 'Light theme' } };
