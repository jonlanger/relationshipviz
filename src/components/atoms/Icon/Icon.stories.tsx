import type { Meta, StoryObj } from '@storybook/react';
import { Network, Search, Building2, Globe2 } from 'lucide-react';
import { Icon } from './Icon';

const meta: Meta<typeof Icon> = { title: 'Atoms/Icon', component: Icon, args: { icon: Network } };
export default meta;
type Story = StoryObj<typeof Icon>;

export const Default: Story = {};
export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
      {(['xs', 'sm', 'md', 'lg'] as const).map((s) => <Icon key={s} icon={Search} size={s} />)}
      <Icon icon={Building2} /> <Icon icon={Globe2} />
    </div>
  ),
};
