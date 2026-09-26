import type { Meta, StoryObj } from '@storybook/react';
import { dark } from '@/design-system/tokens';
import type { Company } from '@/data/schema';
import { RelationshipPanel } from './RelationshipPanel';

const mk = (id: string, shortName: string): Company => ({
  id, ticker: id, name: shortName, shortName, sector: 'Information Technology', industry: 'Semiconductors', universe: 'SP500',
  marketCap: 1000, employees: 1, aliases: [], hq: { city: '', country: '', countryCode: 'US', lat: 0, lng: 0 },
});
const tsm = mk('TSM', 'TSMC');
const nvda = mk('NVDA', 'Nvidia');

const meta: Meta<typeof RelationshipPanel> = {
  title: 'Organisms/RelationshipPanel', component: RelationshipPanel,
  decorators: [(S) => <div style={{ width: 380, height: 800, background: 'var(--color-bg-surface-1)' }}><S /></div>],
};
export default meta;
export const Verified: StoryObj<typeof RelationshipPanel> = {
  args: {
    a: tsm, b: nvda, tokens: dark, companyIndex: new Map([[tsm.id, tsm], [nvda.id, nvda]]),
    onSelectCompany: () => {}, onClose: () => {},
    relationships: [{
      id: 'tsm__supplier__nvda', source: 'TSM', target: 'NVDA', type: 'supplier', weight: 0.95, confidence: 0.9,
      evidence: [{ kind: 'research', url: 'https://www.trendforce.com/', note: 'Nvidia share of CoWoS capacity.', title: 'TSMC Reportedly Sees CoWoS Order Surge', publisher: 'TrendForce', date: '2025-02-24' }],
      detail: {
        summary: "TSMC manufactures Nvidia's data-center GPUs and packages them with HBM using CoWoS.",
        flows: ['Leading-edge wafer fabrication', 'CoWoS-L advanced packaging'],
        materiality: { revenueShare: { value: 0.19, of: 'TSM', year: 2025, basis: 'Industry estimates' }, dealValueUsdB: null, note: 'Nvidia reportedly holds >60% of CoWoS capacity.' },
        since: null, status: 'active', provenance: 'verified', researchedAt: '2026-09-23',
        events: [{ date: '2025-02', title: 'Nvidia books ~70% of 2025 CoWoS-L capacity', url: null }],
      },
    }],
  },
};
