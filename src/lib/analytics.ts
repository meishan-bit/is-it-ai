/** Pure aggregation for the admin dashboard. No I/O, so it is unit-tested and also runs on sample data. */

export interface ParticipantRow {
  anon_id: string;
  age_band?: string | null;
  device_type?: string | null;
  is_test_code?: boolean | null;
}
export interface AttemptRow {
  attempt_id: string;
  anon_id: string;
  mode: 'practice' | 'pre' | 'post';
  form: string | null;
  started_at: string;
  completed_at: string | null;
  app_version?: string | null;
  content_version?: string | null;
}
export interface ResponseRow {
  attempt_id: string;
  scenario_id: string;
  verdict_choice?: string | null;
  verdict_correct: boolean;
  sign_choice?: string | null;
  sign_correct: boolean;
  step_choice?: string | null;
  step_correct: boolean;
  time_ms: number | null;
  answered_at?: string | null;
}
export interface ScenarioMeta {
  id: string;
  use: string;
  tactic: string;
  pair_id: string | null;
  form: string | null;
  /** Needed to report scams caught and real messages trusted separately (Week 3 test plan). */
  verdict?: 'scam' | 'real';
}

/** Verdict accuracy split by what the message really was: scams caught, real messages trusted. */
export interface VerdictSplit {
  scams_caught: number;
  scams_total: number;
  real_trusted: number;
  real_total: number;
}

export const TARGET_PP = 20;

const r1 = (n: number) => Math.round(n * 10) / 10;
const pct = (num: number, den: number) => (den === 0 ? null : r1((num / den) * 100));
const mean = (xs: number[]) => (xs.length === 0 ? null : r1(xs.reduce((a, b) => a + b, 0) / xs.length));
const points = (rs: ResponseRow[]) => rs.reduce((s, r) => s + (r.verdict_correct ? 1 : 0) + (r.step_correct ? 1 : 0), 0);
const isTestCode = (id: string) => /^T\d+$/.test(id);

function verdictSplit(rs: ResponseRow[], verdictOf: (id: string) => 'scam' | 'real' | undefined): VerdictSplit {
  const out: VerdictSplit = { scams_caught: 0, scams_total: 0, real_trusted: 0, real_total: 0 };
  for (const r of rs) {
    const v = verdictOf(r.scenario_id);
    if (v === 'scam') {
      out.scams_total += 1;
      if (r.verdict_correct) out.scams_caught += 1;
    } else if (v === 'real') {
      out.real_total += 1;
      if (r.verdict_correct) out.real_trusted += 1;
    }
  }
  return out;
}

function splitPct(splits: VerdictSplit[], part: 'scams' | 'real'): number | null {
  const num = splits.reduce((a, s) => a + (part === 'scams' ? s.scams_caught : s.real_trusted), 0);
  const den = splits.reduce((a, s) => a + (part === 'scams' ? s.scams_total : s.real_total), 0);
  return pct(num, den);
}

export interface TesterRow {
  anon_id: string;
  pre_form: string | null;
  post_form: string | null;
  pre_points: number | null;
  post_points: number | null;
  max: number;
  change_points: number | null;
  change_pp: number | null;
  pre_split: VerdictSplit | null;
  post_split: VerdictSplit | null;
}

export interface AdminStats {
  generated_at: string;
  totals: { learners: number; testers: number; attempts: number; completed_attempts: number };
  practice: {
    attempts: number;
    completed: number;
    completion_rate: number | null;
    avg_round_score_pct: number | null;
    avg_seconds_per_example: number | null;
    rounds_per_learner: number | null;
  };
  testing: {
    testers: number;
    completed_pre: number;
    completed_post: number;
    completed_both: number;
    completion_rate: number | null;
    avg_pre_pct: number | null;
    avg_post_pct: number | null;
    avg_change_points: number | null;
    avg_change_pp: number | null;
    target_pp: number;
    target_met: boolean | null;
    improved: number;
    /** Share of scam items called "scam" and real items called "real", across finished testers. */
    pre_scams_caught_pct: number | null;
    pre_real_trusted_pct: number | null;
    post_scams_caught_pct: number | null;
    post_real_trusted_pct: number | null;
    rows: TesterRow[];
  };
  by_tactic: { tactic: string; responses: number; both_pct: number | null; verdict_pct: number | null; step_pct: number | null }[];
  by_scenario: {
    id: string;
    use: string;
    tactic: string;
    responses: number;
    verdict_pct: number | null;
    sign_pct: number | null;
    step_pct: number | null;
    both_pct: number | null;
    avg_seconds: number | null;
  }[];
  pairs: {
    pair: string;
    a_id: string;
    b_id: string;
    a_n: number;
    b_n: number;
    a_pct: number | null;
    b_pct: number | null;
    diff_pp: number | null;
    status: 'too_few' | 'similar' | 'check';
  }[];
  by_device: { label: string; count: number }[];
  by_age: { label: string; count: number }[];
  by_version: { label: string; attempts: number }[];
  activity: { date: string; practice: number; test: number }[];
}

function countBy<T>(items: T[], key: (t: T) => string): { label: string; count: number }[] {
  const m = new Map<string, number>();
  for (const it of items) m.set(key(it), (m.get(key(it)) ?? 0) + 1);
  return Array.from(m.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function aggregate(
  participants: ParticipantRow[],
  attempts: AttemptRow[],
  responses: ResponseRow[],
  scenarios: ScenarioMeta[],
  now: Date = new Date(),
): AdminStats {
  const byId = new Map(scenarios.map((s) => [s.id, s]));
  const verdictOf = (id: string) => byId.get(id)?.verdict;
  const resByAttempt = new Map<string, ResponseRow[]>();
  for (const r of responses) {
    const list = resByAttempt.get(r.attempt_id);
    if (list) list.push(r);
    else resByAttempt.set(r.attempt_id, [r]);
  }
  const attemptById = new Map(attempts.map((a) => [a.attempt_id, a]));

  const practiceAttempts = attempts.filter((a) => a.mode === 'practice');
  const testAttempts = attempts.filter((a) => a.mode !== 'practice');
  const completedPractice = practiceAttempts.filter((a) => a.completed_at);

  const learners = new Set(practiceAttempts.map((a) => a.anon_id).filter((id) => !isTestCode(id)));
  const testerIds = new Set(testAttempts.map((a) => a.anon_id));

  // ---- practice
  const roundScores = completedPractice
    .map((a) => resByAttempt.get(a.attempt_id) ?? [])
    .filter((rs) => rs.length > 0)
    .map((rs) => (rs.filter((r) => r.verdict_correct && r.step_correct).length / rs.length) * 100);
  const practiceResponses = responses.filter((r) => attemptById.get(r.attempt_id)?.mode === 'practice');
  const practiceTimes = practiceResponses.map((r) => r.time_ms).filter((t): t is number => typeof t === 'number');

  // ---- testing
  const rows: TesterRow[] = [];
  for (const id of Array.from(testerIds).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))) {
    const mine = testAttempts.filter((a) => a.anon_id === id && a.completed_at);
    const latest = (mode: 'pre' | 'post') =>
      mine.filter((a) => a.mode === mode).sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''))[0];
    const pre = latest('pre');
    const post = latest('post');
    const preR = pre ? resByAttempt.get(pre.attempt_id) ?? [] : [];
    const postR = post ? resByAttempt.get(post.attempt_id) ?? [] : [];
    const prePts = pre ? points(preR) : null;
    const postPts = post ? points(postR) : null;
    const max = Math.max(preR.length, postR.length, 5) * 2;
    rows.push({
      anon_id: id,
      pre_form: pre?.form ?? null,
      post_form: post?.form ?? null,
      pre_points: prePts,
      post_points: postPts,
      max,
      change_points: prePts !== null && postPts !== null ? postPts - prePts : null,
      change_pp: prePts !== null && postPts !== null ? r1(((postPts - prePts) / max) * 100) : null,
      pre_split: pre ? verdictSplit(preR, verdictOf) : null,
      post_split: post ? verdictSplit(postR, verdictOf) : null,
    });
  }
  const both = rows.filter((r) => r.pre_points !== null && r.post_points !== null);
  const avgChangePp = mean(both.map((r) => r.change_pp as number));

  // ---- per scenario / tactic
  const per = new Map<string, ResponseRow[]>();
  for (const r of responses) {
    const l = per.get(r.scenario_id);
    if (l) l.push(r);
    else per.set(r.scenario_id, [r]);
  }
  const by_scenario = scenarios
    .filter((s) => (per.get(s.id) ?? []).length > 0)
    .map((s) => {
      const rs = per.get(s.id) ?? [];
      const times = rs.map((r) => r.time_ms).filter((t): t is number => typeof t === 'number');
      return {
        id: s.id,
        use: s.use,
        tactic: s.tactic,
        responses: rs.length,
        verdict_pct: pct(rs.filter((r) => r.verdict_correct).length, rs.length),
        sign_pct: pct(rs.filter((r) => r.sign_correct).length, rs.length),
        step_pct: pct(rs.filter((r) => r.step_correct).length, rs.length),
        both_pct: pct(rs.filter((r) => r.verdict_correct && r.step_correct).length, rs.length),
        avg_seconds: times.length ? r1(times.reduce((a, b) => a + b, 0) / times.length / 1000) : null,
      };
    });

  const tacticMap = new Map<string, ResponseRow[]>();
  for (const r of responses) {
    const t = byId.get(r.scenario_id)?.tactic;
    if (!t) continue;
    const l = tacticMap.get(t);
    if (l) l.push(r);
    else tacticMap.set(t, [r]);
  }
  const by_tactic = Array.from(tacticMap.entries())
    .map(([tactic, rs]) => ({
      tactic,
      responses: rs.length,
      both_pct: pct(rs.filter((r) => r.verdict_correct && r.step_correct).length, rs.length),
      verdict_pct: pct(rs.filter((r) => r.verdict_correct).length, rs.length),
      step_pct: pct(rs.filter((r) => r.step_correct).length, rs.length),
    }))
    .sort((a, b) => a.tactic.localeCompare(b.tactic, undefined, { numeric: true }));

  // ---- pair balance (Tiffany's check that Form A and Form B twins are equally hard), test attempts only
  const testResponses = responses.filter((r) => {
    const a = attemptById.get(r.attempt_id);
    return a && a.mode !== 'practice';
  });
  const pairIds = Array.from(new Set(scenarios.map((s) => s.pair_id).filter((p): p is string => Boolean(p)))).sort();
  const pairs = pairIds.map((pair) => {
    const a = scenarios.find((s) => s.pair_id === pair && s.form === 'A');
    const b = scenarios.find((s) => s.pair_id === pair && s.form === 'B');
    const ar = testResponses.filter((r) => r.scenario_id === a?.id);
    const br = testResponses.filter((r) => r.scenario_id === b?.id);
    const ap = pct(ar.filter((r) => r.verdict_correct && r.step_correct).length, ar.length);
    const bp = pct(br.filter((r) => r.verdict_correct && r.step_correct).length, br.length);
    const diff = ap !== null && bp !== null ? r1(bp - ap) : null;
    const status: 'too_few' | 'similar' | 'check' =
      ar.length < 5 || br.length < 5 || diff === null ? 'too_few' : Math.abs(diff) <= 15 ? 'similar' : 'check';
    return { pair, a_id: a?.id ?? '', b_id: b?.id ?? '', a_n: ar.length, b_n: br.length, a_pct: ap, b_pct: bp, diff_pp: diff, status };
  });

  // ---- who / what
  const allIds = new Set(attempts.map((a) => a.anon_id));
  const people = participants.filter((p) => allIds.has(p.anon_id));
  const by_device = countBy(people, (p) => p.device_type || 'Not recorded');
  const by_age = countBy(
    people.filter((p) => testerIds.has(p.anon_id)),
    (p) => p.age_band || 'Not given',
  );
  const vc = countBy(attempts, (a) => `v${a.app_version ?? '?'} · content ${a.content_version ?? '?'}`);
  const by_version = vc.map((v) => ({ label: v.label, attempts: v.count }));

  // ---- last 14 days
  const days: string[] = [];
  for (let i = 13; i >= 0; i--) days.push(new Date(now.getTime() - i * 86400000).toISOString().slice(0, 10));
  const activity = days.map((date) => ({
    date,
    practice: practiceAttempts.filter((a) => a.started_at.slice(0, 10) === date).length,
    test: testAttempts.filter((a) => a.started_at.slice(0, 10) === date).length,
  }));

  return {
    generated_at: now.toISOString(),
    totals: {
      learners: learners.size,
      testers: testerIds.size,
      attempts: attempts.length,
      completed_attempts: attempts.filter((a) => a.completed_at).length,
    },
    practice: {
      attempts: practiceAttempts.length,
      completed: completedPractice.length,
      completion_rate: pct(completedPractice.length, practiceAttempts.length),
      avg_round_score_pct: mean(roundScores),
      avg_seconds_per_example: practiceTimes.length
        ? r1(practiceTimes.reduce((a, b) => a + b, 0) / practiceTimes.length / 1000)
        : null,
      rounds_per_learner: learners.size ? r1(practiceAttempts.filter((a) => learners.has(a.anon_id)).length / learners.size) : null,
    },
    testing: {
      testers: testerIds.size,
      completed_pre: rows.filter((r) => r.pre_points !== null).length,
      completed_post: rows.filter((r) => r.post_points !== null).length,
      completed_both: both.length,
      completion_rate: pct(both.length, testerIds.size),
      avg_pre_pct: mean(both.map((r) => ((r.pre_points as number) / r.max) * 100)),
      avg_post_pct: mean(both.map((r) => ((r.post_points as number) / r.max) * 100)),
      avg_change_points: mean(both.map((r) => r.change_points as number)),
      avg_change_pp: avgChangePp,
      target_pp: TARGET_PP,
      target_met: avgChangePp === null ? null : avgChangePp >= TARGET_PP,
      improved: both.filter((r) => (r.change_pp as number) > 0).length,
      pre_scams_caught_pct: splitPct(both.map((r) => r.pre_split as VerdictSplit), 'scams'),
      pre_real_trusted_pct: splitPct(both.map((r) => r.pre_split as VerdictSplit), 'real'),
      post_scams_caught_pct: splitPct(both.map((r) => r.post_split as VerdictSplit), 'scams'),
      post_real_trusted_pct: splitPct(both.map((r) => r.post_split as VerdictSplit), 'real'),
      rows,
    },
    by_tactic,
    by_scenario,
    pairs,
    by_device,
    by_age,
    by_version,
    activity,
  };
}
