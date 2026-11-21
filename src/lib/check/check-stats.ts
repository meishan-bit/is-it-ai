import type { CheckEventRow } from './types';

/** Admin numbers for Check It. Counts and timings only: there is no message content to show. */
export interface CheckStats {
  total: number;
  checks_ok: number;
  failed: number;
  by_input_type: Array<{ label: string; count: number }>;
  by_signal_level: Array<{ label: string; count: number }>;
  by_tactic: Array<{ label: string; count: number }>;
  by_outcome: Array<{ label: string; count: number }>;
  median_latency_ms: number | null;
  /** Of photo and paste checks, the share where the person showed a detail we hid. */
  unhid_share_pct: number | null;
  /** Of photo and paste checks, the share where the person hid extra words. */
  added_share_pct: number | null;
  still_personal_pct: number | null;
  activity: Array<{ date: string; count: number }>;
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const pct = (n: number, d: number) => (d === 0 ? null : r1((n / d) * 100));

function tally(values: string[]): Array<{ label: string; count: number }> {
  const m = new Map<string, number>();
  for (const v of values) m.set(v, (m.get(v) ?? 0) + 1);
  return Array.from(m.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, undefined, { numeric: true }));
}

export function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

export function aggregateChecks(rows: CheckEventRow[], now: Date = new Date()): CheckStats {
  const ok = rows.filter((r) => r.outcome === 'ok');
  const redactable = rows.filter((r) => (r.input_type === 'photo' || r.input_type === 'paste') && r.outcome !== 'rate_limited');
  const days: string[] = [];
  for (let i = 13; i >= 0; i--) days.push(new Date(now.getTime() - i * 86400000).toISOString().slice(0, 10));
  return {
    total: rows.length,
    checks_ok: ok.length,
    failed: rows.filter((r) => r.outcome !== 'ok').length,
    by_input_type: tally(rows.map((r) => r.input_type)),
    by_signal_level: tally(ok.map((r) => r.signal_level ?? 'unknown')),
    by_tactic: tally(ok.map((r) => r.tactic_id ?? 'unknown')),
    by_outcome: tally(rows.map((r) => r.outcome)),
    median_latency_ms: median(ok.map((r) => r.latency_ms).filter((n): n is number => typeof n === 'number')),
    unhid_share_pct: pct(redactable.filter((r) => r.user_unhid_count > 0).length, redactable.length),
    added_share_pct: pct(redactable.filter((r) => r.user_added_count > 0).length, redactable.length),
    still_personal_pct: pct(ok.filter((r) => r.still_personal === true).length, ok.filter((r) => r.still_personal !== null).length),
    activity: days.map((date) => ({ date, count: rows.filter((r) => (r.created_at ?? '').slice(0, 10) === date).length })),
  };
}

/** Made-up rows so the Check It admin page has something to show before Supabase is connected. */
export function buildSampleChecks(now: Date = new Date()): CheckEventRow[] {
  const mk = (i: number, input_type: CheckEventRow['input_type'], tactic: CheckEventRow['tactic_id'], level: CheckEventRow['signal_level'], latency: number, unhid = 0, added = 0, outcome: CheckEventRow['outcome'] = 'ok'): CheckEventRow => ({
    anon_id: `sample-user-${i % 7}`,
    input_type,
    tactic_id: outcome === 'ok' ? tactic : null,
    signal_level: outcome === 'ok' ? level : null,
    outcome,
    redaction_counts: input_type === 'call' ? {} : { 'phone number': 1, name: 1 },
    user_unhid_count: unhid,
    user_added_count: added,
    still_personal: outcome === 'ok' ? i % 9 === 0 : null,
    model: 'claude-haiku-5-5',
    latency_ms: outcome === 'ok' ? latency : null,
    content_version: '2.2.0',
    created_at: new Date(now.getTime() - (i % 12) * 86400000 - i * 60000).toISOString(),
  });
  return [
    mk(1, 'photo', 'T5', 'strong', 2100, 0, 2),
    mk(2, 'photo', 'T4', 'strong', 1900),
    mk(3, 'paste', 'real', 'none_found', 1300, 1),
    mk(4, 'call', 'T1', 'strong', 1500),
    mk(5, 'paste', 'T2', 'some', 1700, 0, 1),
    mk(6, 'call', 'T6', 'strong', 1400),
    mk(7, 'photo', 'real', 'none_found', 2300, 0, 0),
    mk(8, 'paste', 'unknown', 'some', 1600),
    mk(9, 'photo', null, null, 0, 0, 0, 'timeout'),
    mk(10, 'paste', 'T3', 'strong', 1250, 0, 3),
    mk(11, 'call', 'T9', 'strong', 1450),
    mk(12, 'photo', null, null, 0, 0, 0, 'rate_limited'),
  ];
}
