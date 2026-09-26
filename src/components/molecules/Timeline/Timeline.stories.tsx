import type { Meta, StoryObj } from '@storybook/react';
import { Timeline } from './Timeline';

const meta: Meta<typeof Timeline> = { title: 'Molecules/Timeline', component: Timeline, decorators: [(S) => <div style={{ width: 340 }}><S /></div>] };
export default meta;
export const Default: StoryObj<typeof Timeline> = {
  args: {
    events: [
      { date: '2025-10-28', title: 'OpenAI recapitalizes as a PBC; Microsoft holds ~27%', url: 'https://blogs.microsoft.com/' },
      { date: '2026-04-27', title: 'Exclusivity ends; Microsoft stops paying revenue share' },
    ],
  },
};
