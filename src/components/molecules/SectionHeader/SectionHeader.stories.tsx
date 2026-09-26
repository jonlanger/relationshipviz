import type { Meta, StoryObj } from '@storybook/react';
import { Button } from '../../atoms';
import { SectionHeader } from './SectionHeader';

const meta: Meta<typeof SectionHeader> = { title: 'Molecules/SectionHeader', component: SectionHeader, args: { title: 'Sectors' } };
export default meta;
export const WithAction: StoryObj<typeof SectionHeader> = { args: { action: <Button size="sm" variant="ghost">Reset</Button> } };
