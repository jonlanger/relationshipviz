import type { Meta, StoryObj } from '@storybook/react';
import { ZoomIn } from 'lucide-react';
import { IconButton } from '../IconButton';
import { Tooltip } from './Tooltip';

const meta: Meta<typeof Tooltip> = { title: 'Atoms/Tooltip', component: Tooltip };
export default meta;
export const Sides: StoryObj<typeof Tooltip> = {
  render: () => (
    <div style={{ display: 'flex', gap: 48, padding: 48 }}>
      {(['top', 'bottom', 'left', 'right'] as const).map((s) => (
        <Tooltip key={s} content={`Zoom in (${s})`} side={s}>
          <IconButton icon={ZoomIn} label="Zoom in" variant="secondary" />
        </Tooltip>
      ))}
    </div>
  ),
};
