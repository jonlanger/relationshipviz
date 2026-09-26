import type { Shock } from './scenarios';

export interface ScenarioPreset {
  id: string;
  label: string;
  description: string;
  shock: Shock;
}

/**
 * Ready-made stress tests. They illustrate how exposure travels through the network; the
 * severities are round numbers, not forecasts.
 */
export const SCENARIO_PRESETS: ScenarioPreset[] = [
  {
    id: 'taiwan',
    label: 'Taiwan supply disruption',
    description: 'Companies headquartered in Taiwan (TSMC, Foxconn) can’t deliver for a period: chips and assembly stop flowing.',
    shock: { target: { kind: 'country', code: 'TW' }, mode: 'disruption', severity: 0.8 },
  },
  {
    id: 'korea-memory',
    label: 'Korean memory disruption',
    description: 'Samsung and SK hynix output falls sharply, squeezing memory (HBM, DRAM) supply.',
    shock: { target: { kind: 'country', code: 'KR' }, mode: 'disruption', severity: 0.6 },
  },
  {
    id: 'ai-capex',
    label: 'AI spending slowdown',
    description: 'The largest cloud and AI buyers cut data-center spending by about half.',
    shock: { target: { kind: 'company', ids: ['MSFT', 'GOOGL', 'AMZN', 'META', 'ORCL', 'openai'] }, mode: 'demand', severity: 0.5 },
  },
  {
    id: 'chip-tools',
    label: 'Chip-equipment export limits',
    description: 'Lithography and wafer-equipment makers (ASML, Applied Materials, Lam, KLA) can ship much less.',
    shock: { target: { kind: 'company', ids: ['ASML', 'AMAT', 'LRCX', 'KLAC'] }, mode: 'disruption', severity: 0.5 },
  },
  {
    id: 'nvidia',
    label: 'Nvidia supply shortfall',
    description: 'Nvidia can deliver only part of its accelerator orders.',
    shock: { target: { kind: 'company', ids: ['NVDA'] }, mode: 'disruption', severity: 0.5 },
  },
];
