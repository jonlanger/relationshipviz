import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { categorical } from '@/design-system/tokens';
import { Swatch } from '../../atoms';
import { FilterGroup } from './FilterGroup';

const meta: Meta = { title: 'Molecules/FilterGroup' };
export default meta;
const opts = ['Information Technology', 'Communication Services', 'Consumer Discretionary', 'Health Care'].map((s, i) => ({
  value: s, label: s, count: 40 - i * 7, leading: <Swatch color={categorical.dark[i]} size="sm" />,
}));
export const Sectors: StoryObj = {
  render: function Render() {
    const [sel, setSel] = useState(opts.map((o) => o.value));
    return (
      <div style={{ width: 260 }}>
        <FilterGroup title="Sectors" options={opts} selected={sel}
          onToggle={(v) => setSel(sel.includes(v) ? sel.filter((x) => x !== v) : [...sel, v])} onSetAll={setSel} />
      </div>
    );
  },
};
