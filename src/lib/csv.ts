import type { AttemptRow, ResponseRow } from './analytics';

const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;

/**
 * One row per answered example, joined to its attempt. This is the file Erika's pandas script reads.
 * scenario_verdict (last column) says whether the example was really a scam or real, so the verdict score can be
 * split into scams caught and real messages trusted.
 */
export function responsesToCsv(
  attempts: AttemptRow[],
  responses: ResponseRow[],
  verdictOf: (scenarioId: string) => string | undefined = () => undefined,
): string {
  const by = new Map(attempts.map((a) => [a.attempt_id, a]));
  const head = [
    'attempt_id', 'anon_id', 'mode', 'form', 'started_at', 'completed_at', 'app_version', 'content_version',
    'scenario_id', 'verdict_choice', 'verdict_correct', 'sign_choice', 'sign_correct', 'step_choice', 'step_correct', 'time_ms', 'answered_at',
    'scenario_verdict',
  ];
  const lines = [head.join(',')];
  for (const r of responses) {
    const a = by.get(r.attempt_id);
    lines.push(
      [r.attempt_id, a?.anon_id, a?.mode, a?.form, a?.started_at, a?.completed_at, a?.app_version, a?.content_version,
        r.scenario_id, r.verdict_choice, r.verdict_correct, r.sign_choice, r.sign_correct, r.step_choice, r.step_correct, r.time_ms, r.answered_at,
        verdictOf(r.scenario_id)]
        .map(q)
        .join(','),
    );
  }
  return lines.join('\n');
}
