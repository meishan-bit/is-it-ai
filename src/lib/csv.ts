import type { AttemptRow, ResponseRow } from './analytics';

const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;

/** One row per answered example, joined to its attempt. This is the file Erika's pandas script reads. */
export function responsesToCsv(attempts: AttemptRow[], responses: ResponseRow[]): string {
  const by = new Map(attempts.map((a) => [a.attempt_id, a]));
  const head = [
    'attempt_id', 'anon_id', 'mode', 'form', 'started_at', 'completed_at', 'app_version', 'content_version',
    'scenario_id', 'verdict_choice', 'verdict_correct', 'sign_choice', 'sign_correct', 'step_choice', 'step_correct', 'time_ms', 'answered_at',
  ];
  const lines = [head.join(',')];
  for (const r of responses) {
    const a = by.get(r.attempt_id);
    lines.push(
      [r.attempt_id, a?.anon_id, a?.mode, a?.form, a?.started_at, a?.completed_at, a?.app_version, a?.content_version,
        r.scenario_id, r.verdict_choice, r.verdict_correct, r.sign_choice, r.sign_correct, r.step_choice, r.step_correct, r.time_ms, r.answered_at]
        .map(q)
        .join(','),
    );
  }
  return lines.join('\n');
}
