import type { Meta, StoryObj } from '@storybook/react';
import { dark } from '@/design-system/tokens';
import type { Company } from '@/data/schema';
import { CompanyDetailPanel } from './CompanyDetailPanel';

const mk = (id: string, shortName: string, sector: Company['sector']): Company => ({
  id, ticker: id, name: `${shortName} Corporation`, shortName, sector, industry: 'Semiconductors', universe: 'SP500',
  marketCap: 3900, employees: 36000, aliases: [], hq: { city: 'Santa Clara', country: 'United States', countryCode: 'US', lat: 0, lng: 0 },
});
const nvda = mk('NVDA', 'Nvidia', 'Information Technology');
const idx = new Map([nvda, mk('TSM', 'TSMC', 'Information Technology'), mk('MSFT', 'Microsoft', 'Information Technology'), mk('AMD', 'AMD', 'Information Technology')].map((c) => [c.id, c]));
const ev = [{ kind: 'curated' as const, url: 'https://example.com', note: '' }];

const meta: Meta<typeof CompanyDetailPanel> = { title: 'Organisms/CompanyDetailPanel', component: CompanyDetailPanel, decorators: [(S) => <div style={{ width: 360, height: 720, background: 'var(--color-bg-surface-1)' }}><S /></div>] };
export default meta;
export const Default: StoryObj<typeof CompanyDetailPanel> = {
  args: {
    company: nvda, companyIndex: idx, tokens: dark, centralityRank: 1, totalCompanies: 127,
    metrics: { degree: 3, outgoing: 1, incoming: 1, betweenness: 0.18, community: 0 },
    relationships: [
      { id: 'a', source: 'TSM', target: 'NVDA', type: 'supplier', weight: 0.95, confidence: 0.9, evidence: ev },
      { id: 'b', source: 'NVDA', target: 'MSFT', type: 'supplier', weight: 0.9, confidence: 0.9, evidence: ev },
      { id: 'c', source: 'AMD', target: 'NVDA', type: 'competitor', weight: 0.8, confidence: 0.9, evidence: ev },
    ],
    onSelectRelationship: () => {}, onHover: () => {}, onClose: () => {}, onOpenProfile: () => {},
  },
};
