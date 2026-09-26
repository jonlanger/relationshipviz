import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Slider } from './Slider';

const meta: Meta<typeof Slider> = { title: 'Atoms/Slider', component: Slider };
export default meta;
export const Default: StoryObj<typeof Slider> = {
  render: function Render() {
    const [v, setV] = useState(40);
    return <div style={{ width: 260 }}><Slider value={v} onChange={setV} label="Min. confidence" format={(x) => `${x}%`} /></div>;
  },
};
