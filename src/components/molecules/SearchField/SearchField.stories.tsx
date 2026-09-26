import type { Meta, StoryObj } from '@storybook/react';
import { categorical } from '@/design-system/tokens';
import { SearchField } from './SearchField';

const meta: Meta<typeof SearchField> = { title: 'Molecules/SearchField', component: SearchField, decorators: [(S) => <div style={{ width: 320, height: 360 }}><S /></div>] };
export default meta;
export const Default: StoryObj<typeof SearchField> = {
  args: {
    onSelect: () => {},
    items: [
      { id: 'NVDA', ticker: 'NVDA', label: 'Nvidia', sublabel: 'Semiconductors', color: categorical.dark[0] },
      { id: 'TSM', ticker: 'TSM', label: 'TSMC', sublabel: 'Semiconductors', color: categorical.dark[0], keywords: ['Taiwan Semiconductor'] },
      { id: 'META', ticker: 'META', label: 'Meta', sublabel: 'Interactive Media', color: categorical.dark[1] },
      { id: 'JPM', ticker: 'JPM', label: 'JPMorgan', sublabel: 'Diversified Banks', color: categorical.dark[4] },
    ],
  },
};
