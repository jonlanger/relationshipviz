import type { Meta, StoryObj } from '@storybook/react';
import { dark } from '@/design-system/tokens';
import { lensCompanies, lensResult } from '../LensScorecard/lensFixture';
import { LensQuadrantChart } from './LensQuadrantChart';

const meta: Meta<typeof LensQuadrantChart> = {
  title: 'Organisms/Charts/LensQuadrantChart',
  component: LensQuadrantChart,
  decorators: [(S) => <div style={{ width: 720 }}><S /></div>],
  args: {
    tokens: dark,
    height: 380,
    data: lensCompanies.map((c) => ({ company: c, ...lensResult.byId.get(c.id)! })),
  },
};
export default meta;
export const Default: StoryObj<typeof LensQuadrantChart> = {};
