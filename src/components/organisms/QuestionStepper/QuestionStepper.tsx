import { useEffect, useRef, type ReactNode } from 'react';
import clsx from 'clsx';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { Button, Heading, Icon, Text } from '../../atoms';
import styles from './QuestionStepper.module.css';

export interface QuestionOption {
  value: string;
  label: string;
  description?: string;
}

export interface Question {
  id: string;
  title: string;
  help?: string;
  /** single: pick one · multi: pick any (including none). */
  kind: 'single' | 'multi';
  options: QuestionOption[];
  /** Extra controls under the options (e.g. a toggle). */
  extra?: ReactNode;
  /** Label for "none selected" in multi questions. */
  noneLabel?: string;
}

export interface QuestionStepperProps {
  questions: Question[];
  step: number;
  values: Record<string, string | string[]>;
  onChange: (id: string, value: string | string[]) => void;
  onStep: (step: number) => void;
  onFinish: () => void;
  finishLabel?: string;
  className?: string;
}

/** One question per screen, with progress, back/next, and keyboard-friendly option cards. */
export function QuestionStepper({ questions, step, values, onChange, onStep, onFinish, finishLabel = 'See ideas', className }: QuestionStepperProps) {
  const q = questions[step];
  const last = step === questions.length - 1;
  const headingRef = useRef<HTMLDivElement>(null);
  // Move focus to the new question so keyboard and screen-reader users follow along.
  useEffect(() => headingRef.current?.focus(), [step]);

  const value = values[q.id];
  const selected = (v: string) => (Array.isArray(value) ? value.includes(v) : value === v);
  const pick = (v: string) => {
    if (q.kind === 'single') {
      onChange(q.id, v);
      return;
    }
    const list = Array.isArray(value) ? value : [];
    onChange(q.id, list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  };

  return (
    <section className={clsx(styles.stepper, className)} aria-label="Idea finder questions">
      <div className={styles.progress} aria-hidden>
        {questions.map((x, i) => (
          <span key={x.id} className={clsx(styles.tick, i < step && styles.done, i === step && styles.current)} />
        ))}
      </div>
      <Text variant="overline" tone="tertiary">Question {step + 1} of {questions.length}</Text>
      <div ref={headingRef} tabIndex={-1} className={styles.title}>
        <Heading level="h1" as="h2">{q.title}</Heading>
      </div>
      {q.help && <Text as="p" variant="body" tone="secondary">{q.help}</Text>}

      <div className={styles.options} role={q.kind === 'single' ? 'radiogroup' : 'group'} aria-label={q.title}>
        {q.options.map((o) => {
          const on = selected(o.value);
          return (
            <button
              key={o.value}
              type="button"
              role={q.kind === 'single' ? 'radio' : 'checkbox'}
              aria-checked={on}
              className={clsx(styles.option, on && styles.on)}
              onClick={() => pick(o.value)}
            >
              <span className={styles.mark} aria-hidden>{on && <Icon icon={Check} size="xs" />}</span>
              <span className={styles.body}>
                <span className={styles.label}>{o.label}</span>
                {o.description && <span className={styles.desc}>{o.description}</span>}
              </span>
            </button>
          );
        })}
      </div>
      {q.kind === 'multi' && q.noneLabel && Array.isArray(value) && value.length === 0 && (
        <Text as="p" variant="caption" tone="tertiary">{q.noneLabel}</Text>
      )}
      {q.extra}

      <div className={styles.nav}>
        <Button variant="ghost" leadingIcon={ArrowLeft} onClick={() => onStep(step - 1)} disabled={step === 0}>Back</Button>
        {last ? (
          <Button variant="primary" trailingIcon={ArrowRight} onClick={onFinish}>{finishLabel}</Button>
        ) : (
          <Button variant="primary" trailingIcon={ArrowRight} onClick={() => onStep(step + 1)} disabled={q.kind === 'single' && !value}>Next</Button>
        )}
      </div>
    </section>
  );
}
