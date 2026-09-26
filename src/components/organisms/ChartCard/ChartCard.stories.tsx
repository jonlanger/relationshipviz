import type { Meta, StoryObj } from '@storybook/react';
import { ChartCard, DataTable } from './ChartCard';

const meta: Meta<typeof ChartCard> = { title: 'Organisms/ChartCard', component: ChartCard, decorators: [(S) => <div style={{ width: 520 }}><S /></div>] };
export default meta;
export const WithTable: StoryObj<typeof ChartCard> = {
  args: {
    title: 'Most central companies',
    description: 'Betweenness centrality: how often a company sits on the shortest path between two others.',
    children: <div style={{ height: 200, display: 'grid', placeItems: 'center', color: 'var(--color-text-tertiary)' }}>chart</div>,
    table: () => <DataTable columns={['Company', 'Score']} rows={[['Nvidia', 0.18], ['TSMC', 0.14]]} />,
    footnote: 'Source: curated seed + SEC EDGAR',
  },
};
