import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { dark } from '@/design-system/tokens';
import type { Position } from '@/data/portfolio';
import { lensCompanies, lensIndex } from '../LensScorecard/lensFixture';
import { PositionInput } from './PositionInput';

const items = lensCompanies.map((c) => ({ id: c.id, ticker: c.ticker ?? c.id, label: c.shortName }));
const funds = [
  { ticker: 'SMH', name: 'VanEck Semiconductor ETF', kind: 'etf' as const, seriesId: null, asOf: '2025-06-30', filingUrl: null, netAssetsUsdB: 20, holdings: [{ id: 'NVDA', weight: 0.2 }], unmappedWeight: 0.1, topUnmapped: [], unavailable: null, alternative: null },
  { ticker: 'SPY', name: 'SPDR S&P 500 ETF Trust', kind: 'etf' as const, seriesId: null, asOf: null, filingUrl: null, netAssetsUsdB: null, holdings: [], unmappedWeight: 0, topUnmapped: [], unavailable: 'UIT', alternative: 'SPLG' },
];

const meta: Meta<typeof PositionInput> = { title: 'Organisms/PositionInput', component: PositionInput, decorators: [(S) => <div style={{ width: 380 }}><S /></div>] };
export default meta;
export const Default: StoryObj<typeof PositionInput> = {
  render: function Render() {
    const [positions, setPositions] = useState<Position[]>([{ kind: 'stock', id: 'NVDA', amount: 5000 }, { kind: 'fund', id: 'SMH', amount: 10000 }]);
    return (
      <PositionInput
        positions={positions}
        onChange={setPositions}
        companyIndex={lensIndex}
        searchItems={items}
        funds={funds}
        tokens={dark}
        examples={[{ label: 'Chips', positions: [{ kind: 'stock', id: 'AMD', amount: 1 }, { kind: 'stock', id: 'INTC', amount: 1 }] }]}
      />
    );
  },
};
