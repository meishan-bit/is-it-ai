'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from './Icon';
import ScreenHeader from './ScreenHeader';
import ScenarioView, { scenarioSpeech } from './ScenarioView';
import { evaluate } from '@/lib/scoring';
import { seededShuffle, shuffle } from '@/lib/rng';
import type { Option, ResponseRecord, Scenario, Verdict } from '@/lib/types';

type Step = 'verdict' | 'sign' | 'step' | 'feedback';

interface Props {
  scenario: Scenario;
  index: number;
  total: number;
  /** practice = feedback after every example. test = no feedback at all. */
  mode: 'practice' | 'test';
  seed?: string;
  isLast: boolean;
  onAnswered: (r: ResponseRecord) => void;
  onNext: () => void;
}

const VERDICT_LABEL: Record<Verdict, string> = { scam: 'It is a scam', real: 'It looks real' };
const letter = (i: number) => String.fromCharCode(65 + i);
const optionsSpeech = (opts: Option[]) => opts.map((o, i) => `Choice ${letter(i)}. ${o.text}.`).join(' ');

/** One example, three questions: real or scam, the warning sign, the safe next step. Mount it with key={scenario.id}. */
export default function ItemRunner({ scenario, index, total, mode, seed, isLast, onAnswered, onNext }: Props) {
  const [step, setStep] = useState<Step>('verdict');
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [signId, setSignId] = useState<string | null>(null);
  const [result, setResult] = useState<ResponseRecord | null>(null);
  const startedAt = useRef<number>(Date.now());
  const answered = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);

  const options = useMemo(() => {
    const mix = <T,>(xs: T[], tag: string) => (mode === 'test' && seed ? seededShuffle(xs, `${seed}:${scenario.id}:${tag}`) : shuffle(xs));
    return { sign: mix(scenario.sign_question.options, 'sign'), step: mix(scenario.step_question.options, 'step') };
  }, [scenario, mode, seed]);

  // In a test, prompts are neutral so the wording of question 2 cannot give away the answer to question 1.
  const signPrompt = mode === 'test' ? 'What is the most important clue?' : scenario.sign_question.prompt;
  const stepPrompt = scenario.step_question.prompt;

  useEffect(() => {
    heading.current?.focus();
    window.scrollTo({ top: 0 });
  }, [step]);

  function chooseStep(id: string) {
    if (answered.current || !verdict || !signId) return;
    answered.current = true;
    const ev = evaluate(scenario, { verdict, sign: signId, step: id });
    const rec: ResponseRecord = {
      scenario_id: scenario.id,
      verdict_choice: verdict,
      sign_choice: signId,
      step_choice: id,
      ...ev,
      time_ms: Math.max(0, Date.now() - startedAt.current),
      answered_at: new Date().toISOString(),
    };
    onAnswered(rec);
    if (mode === 'practice') {
      setResult(rec);
      setStep('feedback');
    } else {
      onNext();
    }
  }

  const counter = (
    <>
      <p className="stepcount">
        Example {index + 1} of {total}
        {step !== 'feedback' && (
          <span className="q">Question {step === 'verdict' ? 1 : step === 'sign' ? 2 : 3} of 3</span>
        )}
      </p>
      <div className="dots" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={i < index ? 'done' : i === index ? 'now' : ''} />
        ))}
      </div>
    </>
  );

  // ---------------------------------------------------------------- feedback (practice only)
  if (step === 'feedback' && result) {
    const good = result.verdict_correct && result.step_correct;
    const correctSign = scenario.sign_question.options.find((o) => o.correct)!;
    const correctStep = scenario.step_question.options.find((o) => o.correct)!;
    const Mark = ({ ok }: { ok: boolean }) => (
      <>
        <span className={`mark-icon ${ok ? 'ok' : 'no'}`} aria-hidden="true">{ok ? '✔' : '✖'}</span>
        <span className="sr-only">{ok ? 'Correct.' : 'Not quite.'}</span>
      </>
    );
    const signLabel = scenario.verdict === 'scam' ? 'Warning sign' : 'What makes it look safe';
    const speech = `${good ? 'Well done.' : 'Good try. Here is what to look for.'} ${scenario.explanation} What to do: ${correctStep.text}`;
    return (
      <div className="page">
        <ScreenHeader stop listenText={speech} />
        {counter}
        <h1 ref={heading} tabIndex={-1}>{good ? 'Well done' : 'Good try'}</h1>
        <div className={`verdict-banner ${good ? 'good' : 'try'}`} role="status">
          <span aria-hidden="true">{good ? '✔' : '➜'}</span>
          {good ? 'You got it.' : scenario.verdict === 'scam' ? 'It fools a lot of people. Here is what to look for.' : 'Not every message is a scam. Here is what to look for.'}
        </div>
        <ul className="checks">
          <li>
            <Mark ok={result.verdict_correct} />
            <span>
              <strong>Real or scam:</strong> you said “{VERDICT_LABEL[result.verdict_choice]}”.{' '}
              {result.verdict_correct ? 'That is right.' : `This one is ${scenario.verdict === 'scam' ? 'a scam' : 'real'}.`}
            </span>
          </li>
          <li>
            <Mark ok={result.sign_correct} />
            <span>
              <strong>{signLabel}:</strong> {result.sign_correct ? 'you spotted it.' : correctSign.text + '.'}
            </span>
          </li>
          <li>
            <Mark ok={result.step_correct} />
            <span>
              <strong>Safe step:</strong> {result.step_correct ? 'you chose well.' : 'see the box below.'}
            </span>
          </li>
        </ul>
        <div className="card">
          <h2>Why</h2>
          <p style={{ marginBottom: 0 }}>{scenario.explanation}</p>
        </div>
        <div className="todo">
          <h3>What to do</h3>
          <p>{correctStep.text}.</p>
        </div>
        {(scenario.highlights.length > 0) && <p className="muted">The clues are highlighted below.</p>}
        <ScenarioView scenario={scenario} highlight transcriptOpen />
        {scenario.source_urls.length > 0 && (
          <details className="sources">
            <summary>Where this comes from</summary>
            <ul>
              {scenario.source_urls.map((u, i) => (
                <li key={u}>
                  <a href={u} target="_blank" rel="noopener noreferrer">{scenario.source_labels[i]}</a>
                </li>
              ))}
            </ul>
          </details>
        )}
        <div className="btn-row">
          <button type="button" className="btn" onClick={onNext}>
            {isLast ? 'See my results' : 'Next example'} <Icon name="next" />
          </button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------- the three questions
  let title = 'Is this real or a scam?';
  let body: React.ReactNode;
  let speech: string;

  if (step === 'verdict') {
    speech = `${scenarioSpeech(scenario)} ${title} Choice A. It is a scam. Choice B. It looks real.`;
    body = (
      <div className="btn-row two" role="group" aria-label={title}>
        <button type="button" className="btn-choice" onClick={() => { setVerdict('scam'); setStep('sign'); }}>
          <span className="letter">A.</span> It is a scam
        </button>
        <button type="button" className="btn-choice" onClick={() => { setVerdict('real'); setStep('sign'); }}>
          <span className="letter">B.</span> It looks real
        </button>
      </div>
    );
  } else {
    const isSign = step === 'sign';
    title = isSign ? signPrompt : stepPrompt;
    const opts = isSign ? options.sign : options.step;
    speech = `${title} ${optionsSpeech(opts)}`;
    body = (
      <div role="group" aria-label={title}>
        {opts.map((o, i) => (
          <button
            key={o.id}
            type="button"
            className="btn-choice"
            onClick={() => {
              if (isSign) {
                setSignId(o.id);
                setStep('step');
              } else chooseStep(o.id);
            }}
          >
            <span className="letter">{letter(i)}.</span> {o.text}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="page">
      <ScreenHeader stop listenText={speech} />
      {counter}
      <ScenarioView scenario={scenario} />
      <h1 ref={heading} tabIndex={-1}>{title}</h1>
      {body}
    </div>
  );
}
