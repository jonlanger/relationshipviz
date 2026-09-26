import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { DEFAULT_FILTERS } from '@/data/filters';
import { dark } from '@/design-system/tokens';
import type { ColorBy, LayoutMode, Lens } from '@/app/store';
import { FilterPanel } from './FilterPanel';

const meta: Meta<typeof FilterPanel> = { title: 'Organisms/FilterPanel', component: FilterPanel, decorators: [(S) => <div style={{ width: 280 }}><S /></div>] };
export default meta;
const co = (id: string, sector: 'Information Technology' | 'Energy' | 'Financials') => ({
  id, ticker: id, name: id, shortName: id, sector, industry: '', universe: 'SP500' as const, marketCap: 100, employees: 1, aliases: [],
  hq: { city: '', country: '', countryCode: 'US', lat: 0, lng: 0 },
});
export const Default: StoryObj<typeof FilterPanel> = {
  render: function Render() {
    const [colorBy, setColorBy] = useState<ColorBy>('sector');
    const [layout, setLayout] = useState<LayoutMode>('network');
    const [labels, setLabels] = useState(true);
    const [lens, setLens] = useState<Lens>('off');
    const noop = () => {};
    return (
      <FilterPanel
        companies={[co('A', 'Information Technology'), co('B', 'Energy'), co('C', 'Financials')]}
        relationships={[]}
        filters={DEFAULT_FILTERS}
        tokens={dark}
        colorBy={colorBy} lens={lens} onLens={setLens} layoutMode={layout} showLabels={labels}
        onColorBy={setColorBy} onLayoutMode={setLayout} onShowLabels={setLabels}
        onToggleSector={noop} onSetSectors={noop} onToggleType={noop} onSetTypes={noop} onToggleUniverse={noop} onSetUniverses={noop}
        onMinMarketCap={noop} onMinConfidence={noop} onReset={noop}
      />
    );
  },
};
