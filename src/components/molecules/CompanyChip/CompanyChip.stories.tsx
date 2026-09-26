import type { Meta, StoryObj } from '@storybook/react';
import { categorical } from '@/design-system/tokens';
import { Badge } from '../../atoms';
import { CompanyChip } from './CompanyChip';

const meta: Meta<typeof CompanyChip> = {
  title: 'Molecules/CompanyChip', component: CompanyChip,
  args: { ticker: 'TSM', name: 'TSMC', meta: 'Semiconductors · Hsinchu, TW', color: categorical.dark[0] },
  decorators: [(S) => <div style={{ width: 300, padding: 8 }}><S /></div>],
};
export default meta;
type Story = StoryObj<typeof CompanyChip>;
export const Default: Story = {};
export const Interactive: Story = { args: { onClick: () => {}, trailing: <Badge>Supplier</Badge> } };
