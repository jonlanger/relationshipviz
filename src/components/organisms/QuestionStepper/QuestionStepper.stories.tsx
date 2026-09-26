import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { QuestionStepper, type Question } from './QuestionStepper';

const questions: Question[] = [
  {
    id: 'goal', title: 'What do you want your money to do?', kind: 'single',
    options: [
      { value: 'growth', label: 'Growth', description: 'Companies growing fast.' },
      { value: 'income', label: 'Income', description: 'Dividend payers.' },
    ],
  },
  {
    id: 'themes', title: 'Any themes you want to focus on?', kind: 'multi', noneLabel: 'No themes picked.',
    options: [{ value: 'ai', label: 'AI & semiconductors' }, { value: 'health', label: 'Healthcare innovation' }],
  },
];

const meta: Meta<typeof QuestionStepper> = { title: 'Organisms/QuestionStepper', component: QuestionStepper };
export default meta;
export const Default: StoryObj<typeof QuestionStepper> = {
  render: function Render() {
    const [step, setStep] = useState(0);
    const [values, setValues] = useState<Record<string, string | string[]>>({ goal: 'growth', themes: [] });
    return (
      <QuestionStepper
        questions={questions}
        step={step}
        values={values}
        onChange={(id, v) => setValues((x) => ({ ...x, [id]: v }))}
        onStep={(s) => setStep(Math.max(0, Math.min(questions.length - 1, s)))}
        onFinish={() => {}}
      />
    );
  },
};
