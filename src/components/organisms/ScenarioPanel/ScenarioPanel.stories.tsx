import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { dark } from '@/design-system/tokens';
import { runScenario } from '@/data/scenarios';
import { SCENARIO_PRESETS } from '@/data/scenarioPresets';
import { lensCompanies, lensIndex, lensRelationships } from '../LensScorecard/lensFixture';
import { ScenarioPanel, type ScenarioValue } from './ScenarioPanel';

const meta: Meta<typeof ScenarioPanel> = { title: 'Organisms/ScenarioPanel', component: ScenarioPanel, decorators: [(S) => <div style={{ width: 960 }}><S /></div>] };
export default meta;
export const Default: StoryObj<typeof ScenarioPanel> = {
  render: function Render() {
    const [value, setValue] = useState<ScenarioValue>({ preset: 'taiwan' });
    const shock = 'custom' in value ? value.custom : SCENARIO_PRESETS.find((p) => p.id === value.preset)!.shock;
    return (
      <ScenarioPanel
        presets={SCENARIO_PRESETS}
        value={value}
        onChange={setValue}
        result={runScenario(shock, lensCompanies, lensRelationships)}
        companyIndex={lensIndex}
        tokens={dark}
        searchItems={lensCompanies.map((c) => ({ id: c.id, ticker: c.ticker ?? c.id, label: c.shortName }))}
        countries={[{ code: 'TW', label: 'Taiwan' }, { code: 'US', label: 'United States' }]}
        portfolioImpact={0.18}
        onShowOnGraph={() => {}}
        onSelectCompany={() => {}}
      />
    );
  },
};
