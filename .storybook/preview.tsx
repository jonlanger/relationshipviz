import type { Preview } from '@storybook/react';
import { withThemeByDataAttribute } from '@storybook/addon-themes';
import { MemoryRouter } from 'react-router-dom';
import '../src/design-system';
import { ThemeProvider } from '../src/design-system';

const preview: Preview = {
  parameters: {
    layout: 'centered',
    backgrounds: { disable: true },
    controls: { matchers: { color: /(background|color)$/i } },
    a11y: { test: 'todo' },
    options: {
      storySort: { order: ['Foundations', 'Atoms', 'Molecules', 'Organisms', 'Templates'] },
    },
  },
  decorators: [
    (Story, ctx) => (
      <ThemeProvider initial={ctx.globals.theme === 'light' ? 'light' : 'dark'}>
        <MemoryRouter>
          <Story />
        </MemoryRouter>
      </ThemeProvider>
    ),
    withThemeByDataAttribute({
      themes: { dark: 'dark', light: 'light' },
      defaultTheme: 'dark',
      attributeName: 'data-theme',
    }),
  ],
};
export default preview;
