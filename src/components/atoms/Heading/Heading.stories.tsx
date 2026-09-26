import type { Meta, StoryObj } from '@storybook/react';
import { Heading } from './Heading';

const meta: Meta<typeof Heading> = { title: 'Atoms/Heading', component: Heading, args: { children: 'Global supply network' } };
export default meta;
type Story = StoryObj<typeof Heading>;

export const Default: Story = {};
export const Hierarchy: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: 16 }}>
      <Heading level="hero">4.2T</Heading>
      <Heading level="display">Display — 32/40</Heading>
      <Heading level="h1">Heading 1 — 24/32</Heading>
      <Heading level="h2">Heading 2 — 18/26</Heading>
      <Heading level="h3">Heading 3 — 15/22</Heading>
    </div>
  ),
};
