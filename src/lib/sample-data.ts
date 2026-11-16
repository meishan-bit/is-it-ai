import type { AttemptRow, ParticipantRow, ResponseRow, ScenarioMeta } from './analytics';
import { mulberry32 } from './rng';

/**
 * Made-up data so the admin dashboard has something to show before Supabase is connected.
 * The admin page labels it "Sample data". Deterministic: the same seed always gives the same numbers.
 */
export function buildSampleData(
  scenarios: (ScenarioMeta & { correct_sign?: string; correct_step?: string })[],
  now: Date = new Date(),
): { participants: ParticipantRow[]; attempts: AttemptRow[]; responses: ResponseRow[] } {
  const rand = mulberry32(2026);
  const participants: ParticipantRow[] = [];
  const attempts: AttemptRow[] = [];
  const responses: ResponseRow[] = [];
  let uid = 0;
  const uuid = () => {
    uid += 1;
    const h = uid.toString(16).padStart(12, '0');
    return `00000000-0000-4000-8000-${h}`;
  };
  const day = (back: number) => new Date(now.getTime() - back * 86400000 - Math.floor(rand() * 40000000));
  const devices = ['phone', 'phone', 'tablet', 'desktop', 'phone', 'tablet'];
  const bands = ['60-69', '60-69', '70-79', '70-79', '80+'];

  const practicePool = scenarios.filter((s) => s.use === 'practice');
  const formItems = (form: string) => scenarios.filter((s) => s.form === form && s.use !== 'practice');

  function addAttempt(
    anon: string,
    mode: 'practice' | 'pre' | 'post',
    form: string | null,
    items: ScenarioMeta[],
    p: number,
    started: Date,
    finish: boolean,
  ) {
    const id = uuid();
    const done = finish ? new Date(started.getTime() + 6 * 60000) : null;
    attempts.push({
      attempt_id: id,
      anon_id: anon,
      mode,
      form,
      started_at: started.toISOString(),
      completed_at: done ? done.toISOString() : null,
      app_version: '1.0.0',
      content_version: '1.0.0',
    });
    const upto = finish ? items.length : Math.max(1, Math.floor(items.length * rand()));
    items.slice(0, upto).forEach((s, i) => {
      const hardness = s.tactic === 'T7' || s.tactic === 'T9' ? 0.12 : s.tactic === 'real' ? 0.05 : 0;
      const v = rand() < p - hardness;
      const st = rand() < p - hardness - 0.04;
      const sg = rand() < p - 0.05;
      responses.push({
        attempt_id: id,
        scenario_id: s.id,
        verdict_choice: v ? 'ok' : 'x',
        verdict_correct: v,
        sign_choice: sg ? 'a' : 'b',
        sign_correct: sg,
        step_choice: st ? 'a' : 'c',
        step_correct: st,
        time_ms: Math.round((mode === 'practice' ? 38000 : 52000) + rand() * 40000),
        answered_at: new Date(started.getTime() + (i + 1) * 60000).toISOString(),
      });
    });
  }

  for (let i = 1; i <= 18; i++) {
    const anon = `sample-learner-${String(i).padStart(2, '0')}`;
    participants.push({ anon_id: anon, device_type: devices[i % devices.length], age_band: null, is_test_code: false });
    const rounds = 1 + Math.floor(rand() * 3);
    for (let r = 0; r < rounds; r++) {
      const items = practicePool.slice(0, 5);
      addAttempt(anon, 'practice', null, items, 0.66 + r * 0.08 + rand() * 0.12, day(Math.floor(rand() * 13)), rand() < 0.82);
    }
  }
  for (let i = 1; i <= 5; i++) {
    const code = `T${i}`;
    participants.push({ anon_id: code, device_type: i % 2 ? 'phone' : 'tablet', age_band: bands[i - 1], is_test_code: true });
    const order = i % 2 === 1 ? ['A', 'B'] : ['B', 'A'];
    const base = day(8 - i);
    addAttempt(code, 'pre', order[0], formItems(order[0]), 0.5 + rand() * 0.12, base, true);
    addAttempt(code, 'practice', null, practicePool.slice(0, 5), 0.8, new Date(base.getTime() + 20 * 60000), true);
    addAttempt(code, 'post', order[1], formItems(order[1]), i === 5 ? 0.6 : 0.85, new Date(base.getTime() + 60 * 60000), i !== 4);
  }
  return { participants, attempts, responses };
}
