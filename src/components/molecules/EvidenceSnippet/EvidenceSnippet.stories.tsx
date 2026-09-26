import type { Meta, StoryObj } from '@storybook/react';
import { EvidenceSnippet } from './EvidenceSnippet';

const meta: Meta<typeof EvidenceSnippet> = { title: 'Molecules/EvidenceSnippet', component: EvidenceSnippet, decorators: [(S) => <div style={{ width: 340 }}><S /></div>] };
export default meta;
type Story = StoryObj<typeof EvidenceSnippet>;
export const Curated: Story = { args: { kind: 'curated', note: 'Manufactures Apple-designed A-series and M-series processors.', url: 'https://investor.tsmc.com/english', heading: 'TSMC supplies Apple' } };
export const Filing: Story = { args: { kind: 'filing', date: '2026-02-25', note: 'We utilize foundries, such as Taiwan Semiconductor Manufacturing Company Limited, or TSMC, and Samsung Electronics Co., Ltd., or Samsung, to produce our semiconductor wafers.', url: 'https://www.sec.gov/Archives/edgar/data/1045810/x.htm' } };
