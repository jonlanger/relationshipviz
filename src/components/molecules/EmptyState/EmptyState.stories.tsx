import type { Meta, StoryObj } from '@storybook/react';
import { FilterX } from 'lucide-react';
import { Button } from '../../atoms';
import { EmptyState } from './EmptyState';

const meta: Meta<typeof EmptyState> = { title: 'Molecules/EmptyState', component: EmptyState };
export default meta;
export const NoResults: StoryObj<typeof EmptyState> = {
  args: { icon: FilterX, title: 'No companies match', description: 'Loosen the sector or market-cap filters to bring companies back.', action: <Button>Reset filters</Button> },
};
