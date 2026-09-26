import type { Meta, StoryObj } from '@storybook/react';
import { Text } from './Text';

const meta: Meta<typeof Text> = {
  title: 'Atoms/Text',
  component: Text,
  args: { children: 'Apple supplies nothing; TSMC supplies Apple.' },
};
export default meta;
type Story = StoryObj<typeof Text>;

export const Default: Story = {};
export const Scale: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: 12 }}>
      <Text variant="bodyLg">Body large — 16/24</Text>
      <Text variant="body">Body — 14/20</Text>
      <Text variant="bodySm">Body small — 13/18</Text>
      <Text variant="caption">Caption — 12/16</Text>
      <Text variant="overline" tone="tertiary">Overline — 11/14</Text>
    </div>
  ),
};
export const Tones: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: 8 }}>
      {(['primary', 'secondary', 'tertiary', 'accent', 'good', 'critical'] as const).map((t) => (
        <Text key={t} tone={t}>{t}</Text>
      ))}
    </div>
  ),
};
export const Mono: Story = { args: { mono: true, children: 'NVDA  $4.21T' } };
