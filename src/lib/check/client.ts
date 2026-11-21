import type { CheckResult } from './types';

export type CheckErrorKind = 'offline' | 'too_many' | 'wrong';
export type CheckOutcome = { ok: true; result: CheckResult } | { ok: false; kind: CheckErrorKind };

/** Posts one check. The phone gives up at 30 seconds (the server stops at 25). Never throws. */
export async function postCheck(payload: unknown, opts: { timeoutMs?: number; fetchImpl?: typeof fetch } = {}): Promise<CheckOutcome> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), opts.timeoutMs ?? 30_000);
  try {
    const res = await (opts.fetchImpl ?? fetch)('/api/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctl.signal,
    });
    if (res.status === 429) return { ok: false, kind: 'too_many' };
    if (!res.ok) return { ok: false, kind: 'wrong' };
    return { ok: true, result: (await res.json()) as CheckResult };
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') return { ok: false, kind: 'wrong' };
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    return { ok: false, kind: offline ? 'offline' : 'wrong' };
  } finally {
    clearTimeout(timer);
  }
}
