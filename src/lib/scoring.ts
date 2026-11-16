import type { ResponseRecord, Scenario, Verdict } from './types';

export interface Choices {
  verdict: Verdict;
  sign: string;
  step: string;
}

export function evaluate(
  scenario: Scenario,
  choices: Choices,
): Pick<ResponseRecord, 'verdict_correct' | 'sign_correct' | 'step_correct'> {
  const signOpt = scenario.sign_question.options.find((o) => o.id === choices.sign);
  const stepOpt = scenario.step_question.options.find((o) => o.id === choices.step);
  return {
    verdict_correct: choices.verdict === scenario.verdict,
    sign_correct: Boolean(signOpt && signOpt.correct),
    step_correct: Boolean(stepOpt && stepOpt.correct),
  };
}

/** Pre/post scoring from Week 1: 1 point for the verdict, 1 for the safe step. The warning-sign answer is tracked, not scored. */
export function itemPoints(r: Pick<ResponseRecord, 'verdict_correct' | 'step_correct'>): number {
  return (r.verdict_correct ? 1 : 0) + (r.step_correct ? 1 : 0);
}

export function scoreResponses(rs: readonly Pick<ResponseRecord, 'verdict_correct' | 'step_correct'>[]): {
  points: number;
  max: number;
} {
  return { points: rs.reduce((sum, r) => sum + itemPoints(r), 0), max: rs.length * 2 };
}

/** Practice rounds are friendlier: an example counts as "right" when the verdict and the safe step are both right. */
export function isExampleRight(r: Pick<ResponseRecord, 'verdict_correct' | 'step_correct'>): boolean {
  return r.verdict_correct && r.step_correct;
}
