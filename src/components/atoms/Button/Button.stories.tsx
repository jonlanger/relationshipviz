import type { Meta, StoryObj } from '@storybook/react';
import { Download, ArrowRight } from 'lucide-react';
import { Button } from './Button';

const meta: Meta<typeof Button> = {
  title: 'Atoms/Button',
  component: Button,
  args: { children: 'Export graph' },
  argTypes: {
    variant: { control: 'inline-radio', options: ['primary', 'secondary', 'ghost', 'danger'] },
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
  },
};
export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = { args: { variant: 'primary' } };
export const Secondary: Story = {};
export const Ghost: Story = { args: { variant: 'ghost' } };
export const WithIcons: Story = { args: { leadingIcon: Download, trailingIcon: ArrowRight } };
export const Loading: Story = { args: { loading: true, variant: 'primary' } };
export const Matrix: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: 12 }}>
      {(['sm', 'md', 'lg'] as const).map((size) => (
        <div key={size} style={{ display: 'flex', gap: 8 }}>
          {(['primary', 'secondary', 'ghost', 'danger'] as const).map((v) => (
            <Button key={v} size={size} variant={v}>{v}</Button>
          ))}
          <Button size={size} disabled>disabled</Button>
        </div>
      ))}
    </div>
  ),
};
