import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { SegmentedControl } from './SegmentedControl';

const meta: Meta = { title: 'Molecules/SegmentedControl' };
export default meta;
export const ColorBy: StoryObj = {
  render: function Render() {
    const [v, setV] = useState<'sector' | 'relationship' | 'community'>('sector');
    return (
      <SegmentedControl
        label="Color by"
        value={v}
        onChange={setV}
        options={[{ value: 'sector', label: 'Sector' }, { value: 'relationship', label: 'Relationship' }, { value: 'community', label: 'Community' }]}
      />
    );
  },
};
