import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { categorical } from '@/design-system/tokens';
import { Swatch } from '../Swatch';
import { Tag } from './Tag';

const meta: Meta<typeof Tag> = { title: 'Atoms/Tag', component: Tag, args: { children: 'Information Technology' } };
export default meta;
type Story = StoryObj<typeof Tag>;

export const Default: Story = {};
export const Selected: Story = { args: { selected: true, count: 24, leading: <Swatch color={categorical.dark[0]} size="sm" /> } };
export const Removable: Story = { args: { removable: true, children: 'NVDA' } };
export const Interactive: Story = {
  render: function Render() {
    const [on, setOn] = useState(true);
    return <Tag selected={on} onClick={() => setOn(!on)} leading={<Swatch color={categorical.dark[1]} size="sm" />} count={12}>Health Care</Tag>;
  },
};
