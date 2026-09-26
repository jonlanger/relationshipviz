import type { Meta, StoryObj } from '@storybook/react';
import { MetricRow } from './MetricRow';

const meta: Meta<typeof MetricRow> = { title: 'Molecules/MetricRow', component: MetricRow };
export default meta;
export const List: StoryObj<typeof MetricRow> = {
  render: () => (
    <dl style={{ width: 280 }}>
      <MetricRow label="Market cap" value="$3.9T" />
      <MetricRow label="Counterparties" value="18" fraction={0.72} />
      <MetricRow label="Betweenness" value="0.184" fraction={0.4} />
    </dl>
  ),
};
