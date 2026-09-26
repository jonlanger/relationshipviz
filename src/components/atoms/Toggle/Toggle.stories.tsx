import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Toggle } from './Toggle';

const meta: Meta<typeof Toggle> = { title: 'Atoms/Toggle', component: Toggle };
export default meta;
export const Default: StoryObj<typeof Toggle> = {
  render: function Render() {
    const [on, setOn] = useState(true);
    return <div style={{ width: 240 }}><Toggle checked={on} onChange={setOn} label="Show edge arrows" /></div>;
  },
};
