import type { AttemptRecord, Form, Mode, ResponseRecord } from './types';
import { APP_VERSION, CONTENT_VERSION } from './version';
import { detectDevice, getAnonId, getAttempt, loadOutbox, saveAttempt, saveOutbox, uuid } from './storage';

/**
 * Every answer is saved on the device first (so "My progress" works offline), then queued for the server.
 * The queue keeps events in order and retries later if the network drops. If Supabase is not configured the
 * server replies "stored: false" and the event is simply dropped: nothing breaks.
 */

let flushing = false;

export async function flushOutbox(): Promise<void> {
  if (flushing || typeof window === 'undefined') return;
  flushing = true;
  try {
    for (;;) {
      const q = loadOutbox();
      if (q.length === 0) break;
      let res: Response;
      try {
        res = await fetch('/api/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(q[0]),
          keepalive: true,
        });
      } catch {
        break; // offline: try again next time
      }
      const retry = res.status >= 500 || res.status === 429;
      if (retry) break;
      const cur = loadOutbox();
      cur.shift();
      saveOutbox(cur);
    }
  } finally {
    flushing = false;
  }
}

function enqueue(event: unknown): void {
  const q = loadOutbox();
  q.push(event);
  saveOutbox(q);
  void flushOutbox();
}

export function startAttempt(opts: {
  mode: Mode;
  form: Form | null;
  anonId?: string;
  ageBand?: string | null;
  isTestCode?: boolean;
}): AttemptRecord {
  const anon = opts.anonId ?? getAnonId();
  const attempt: AttemptRecord = {
    attempt_id: uuid(),
    anon_id: anon,
    mode: opts.mode,
    form: opts.form,
    started_at: new Date().toISOString(),
    completed_at: null,
    app_version: APP_VERSION,
    content_version: CONTENT_VERSION,
    responses: [],
  };
  saveAttempt(attempt);
  enqueue({
    event: 'start',
    anon_id: anon,
    age_band: opts.ageBand ?? null,
    device_type: detectDevice(),
    is_test_code: Boolean(opts.isTestCode),
    attempt: {
      attempt_id: attempt.attempt_id,
      mode: attempt.mode,
      form: attempt.form,
      started_at: attempt.started_at,
      app_version: attempt.app_version,
      content_version: attempt.content_version,
    },
  });
  return attempt;
}

export function recordResponse(attemptId: string, r: ResponseRecord): AttemptRecord | undefined {
  const a = getAttempt(attemptId);
  if (!a) return undefined;
  a.responses = [...a.responses.filter((x) => x.scenario_id !== r.scenario_id), r];
  saveAttempt(a);
  enqueue({ event: 'response', attempt_id: attemptId, response: r });
  return a;
}

export function completeAttempt(attemptId: string): AttemptRecord | undefined {
  const a = getAttempt(attemptId);
  if (!a) return undefined;
  a.completed_at = new Date().toISOString();
  saveAttempt(a);
  enqueue({ event: 'complete', attempt_id: attemptId, completed_at: a.completed_at });
  return a;
}

export function attemptsToCsv(attempts: AttemptRecord[]): string {
  const head = [
    'attempt_id', 'anon_id', 'mode', 'form', 'started_at', 'completed_at', 'app_version', 'content_version',
    'scenario_id', 'verdict_choice', 'verdict_correct', 'sign_choice', 'sign_correct', 'step_choice', 'step_correct', 'time_ms', 'answered_at',
  ];
  const rows: string[] = [head.join(',')];
  for (const a of attempts) {
    for (const r of a.responses) {
      rows.push(
        [a.attempt_id, a.anon_id, a.mode, a.form ?? '', a.started_at, a.completed_at ?? '', a.app_version, a.content_version,
          r.scenario_id, r.verdict_choice, r.verdict_correct, r.sign_choice, r.sign_correct, r.step_choice, r.step_correct, r.time_ms, r.answered_at]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(','),
      );
    }
  }
  return rows.join('\n');
}
