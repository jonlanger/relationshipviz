import type { Meta, StoryObj } from '@storybook/react';
import { Divider } from './Divider';

const meta: Meta<typeof Divider> = { title: 'Atoms/Divider', component: Divider };
export default meta;
export const Horizontal: StoryObj<typeof Divider> = { render: () => <div style={{ width: 240 }}><Divider /></div> };
export const Vertical: StoryObj<typeof Divider> = { render: () => <div style={{ display: 'flex', height: 32 }}><Divider orientation="vertical" /></div> };
