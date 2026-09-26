import type { Meta, StoryObj } from '@storybook/react';
import { CompanyFacts } from './CompanyFacts';

const meta: Meta<typeof CompanyFacts> = { title: 'Molecules/CompanyFacts', component: CompanyFacts, decorators: [(S) => <div style={{ width: 340 }}><S /></div>] };
export default meta;
export const Default: StoryObj<typeof CompanyFacts> = {
  args: { facts: [{ label: 'CEO', value: 'Jensen Huang' }, { label: 'Founded', value: 1993 }, { label: 'Exchange', value: 'Nasdaq' }, { label: 'Website', value: 'nvidia.com' }] },
};
