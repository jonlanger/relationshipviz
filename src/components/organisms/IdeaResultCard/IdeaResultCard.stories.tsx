import type { Meta, StoryObj } from '@storybook/react';
import { categorical } from '@/design-system/tokens';
import { IdeaResultCard } from './IdeaResultCard';

const meta: Meta<typeof IdeaResultCard> = {
  title: 'Organisms/IdeaResultCard',
  component: IdeaResultCard,
  decorators: [(S) => <div style={{ width: 340 }}><S /></div>],
  args: {
    rank: 1,
    ticker: 'AVGO',
    name: 'Broadcom',
    sublabel: 'Semiconductors · US',
    tickerColor: categorical.dark[0],
    fit: 82,
    reasons: ['Core AI & semiconductors company', 'Revenue growing +18% a year', 'Fast-growing customer: Alphabet'],
    watchouts: ['Counterparty in Taiwan: TSMC'],
    onOpen: () => {},
    onGraph: () => {},
  },
};
export default meta;
export const Company: StoryObj<typeof IdeaResultCard> = {};
export const Fund: StoryObj<typeof IdeaResultCard> = {
  args: { ticker: 'SMH', name: 'VanEck Semiconductor ETF', sublabel: 'ETF · holdings as of 2025-06-30', tickerColor: undefined, reasons: ['92% of mapped holdings fit your themes', 'Largest holdings: Nvidia, TSMC, Broadcom'], watchouts: ['Overlaps 34% with what you already hold'], onOpen: undefined, onGraph: undefined },
};
