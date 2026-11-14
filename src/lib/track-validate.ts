import type { Form, Mode, Scenario, Verdict } from './types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ANON = /^[A-Za-z0-9_-]{1,64}$/;
const SCEN = /^S\d{2}$/;
const OPT = /^[a-z]$/;
const VERSION = /^[0-9A-Za-z.\-+]{1,32}$/;
const MODES: Mode[] = ['practice', 'pre', 'post'];
const BANDS = ['60-69', '70-79', '80+', 'prefer-not-to-say'];
const DEVICES = ['phone', 'tablet', 'desktop'];

export type TrackEvent =
  | {
      event: 'start';
      anon_id: string;
      age_band: string | null;
      device_type: string | null;
      is_test_code: boolean;
      attempt: {
        attempt_id: string;
        mode: Mode;
        form: Form | null;
        started_at: string;
        app_version: string;
        content_version: string;
      };
    }
  | {
      event: 'response';
      attempt_id: string;
      response: {
        scenario_id: string;
        verdict_choice: Verdict;
        verdict_correct: boolean;
        sign_choice: string;
        sign_correct: boolean;
        step_choice: string;
        step_correct: boolean;
        time_ms: number;
        answered_at: string;
      };
    }
  | { event: 'complete'; attempt_id: string; completed_at: string };

type Result = { ok: true; event: TrackEvent } | { ok: false; error: string };
type Obj = Record<string, unknown>;
type Evaluate = (
  s: Scenario,
  c: { verdict: Verdict; sign: string; step: string },
) => { verdict_correct: boolean; sign_correct: boolean; step_correct: boolean };

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isDate = (v: unknown): v is string => typeof v === 'string' && v.length <= 40 && !Number.isNaN(Date.parse(v));

/**
 * Checks everything the browser sends. Correctness flags are recomputed here from the
 * content file, so a tampered browser cannot write fake "correct" answers.
 */
export function validateTrackEvent(
  body: unknown,
  findScenario: (id: string) => Scenario | undefined,
  evaluate: Evaluate,
): Result {
  if (!isObj(body)) return { ok: false, error: 'body_must_be_object' };

  if (body.event === 'start') {
    const a = body.attempt;
    if (typeof body.anon_id !== 'string' || !ANON.test(body.anon_id)) return { ok: false, error: 'bad_anon_id' };
    if (!isObj(a)) return { ok: false, error: 'bad_attempt' };
    if (typeof a.attempt_id !== 'string' || !UUID.test(a.attempt_id)) return { ok: false, error: 'bad_attempt_id' };
    if (!MODES.includes(a.mode as Mode)) return { ok: false, error: 'bad_mode' };
    const form = a.form === null || a.form === undefined ? null : a.form;
    if (form !== null && form !== 'A' && form !== 'B') return { ok: false, error: 'bad_form' };
    if (!isDate(a.started_at)) return { ok: false, error: 'bad_started_at' };
    if (typeof a.app_version !== 'string' || !VERSION.test(a.app_version)) return { ok: false, error: 'bad_app_version' };
    if (typeof a.content_version !== 'string' || !VERSION.test(a.content_version))
      return { ok: false, error: 'bad_content_version' };
    const band = typeof body.age_band === 'string' && BANDS.includes(body.age_band) ? body.age_band : null;
    const device = typeof body.device_type === 'string' && DEVICES.includes(body.device_type) ? body.device_type : null;
    return {
      ok: true,
      event: {
        event: 'start',
        anon_id: body.anon_id,
        age_band: band,
        device_type: device,
        is_test_code: body.is_test_code === true,
        attempt: {
          attempt_id: a.attempt_id,
          mode: a.mode as Mode,
          form: form as Form | null,
          started_at: a.started_at,
          app_version: a.app_version,
          content_version: a.content_version,
        },
      },
    };
  }

  if (body.event === 'response') {
    const r = body.response;
    if (typeof body.attempt_id !== 'string' || !UUID.test(body.attempt_id)) return { ok: false, error: 'bad_attempt_id' };
    if (!isObj(r)) return { ok: false, error: 'bad_response' };
    if (typeof r.scenario_id !== 'string' || !SCEN.test(r.scenario_id)) return { ok: false, error: 'bad_scenario_id' };
    const scenario = findScenario(r.scenario_id);
    if (!scenario) return { ok: false, error: 'unknown_scenario' };
    if (r.verdict_choice !== 'scam' && r.verdict_choice !== 'real') return { ok: false, error: 'bad_verdict' };
    if (typeof r.sign_choice !== 'string' || !OPT.test(r.sign_choice)) return { ok: false, error: 'bad_sign' };
    if (typeof r.step_choice !== 'string' || !OPT.test(r.step_choice)) return { ok: false, error: 'bad_step' };
    const t = r.time_ms;
    if (typeof t !== 'number' || !Number.isFinite(t) || t < 0 || t > 3_600_000) return { ok: false, error: 'bad_time' };
    if (!isDate(r.answered_at)) return { ok: false, error: 'bad_answered_at' };
    const ev = evaluate(scenario, { verdict: r.verdict_choice, sign: r.sign_choice, step: r.step_choice });
    return {
      ok: true,
      event: {
        event: 'response',
        attempt_id: body.attempt_id,
        response: {
          scenario_id: r.scenario_id,
          verdict_choice: r.verdict_choice,
          sign_choice: r.sign_choice,
          step_choice: r.step_choice,
          time_ms: Math.round(t),
          answered_at: r.answered_at,
          ...ev,
        },
      },
    };
  }

  if (body.event === 'complete') {
    if (typeof body.attempt_id !== 'string' || !UUID.test(body.attempt_id)) return { ok: false, error: 'bad_attempt_id' };
    if (!isDate(body.completed_at)) return { ok: false, error: 'bad_completed_at' };
    return { ok: true, event: { event: 'complete', attempt_id: body.attempt_id, completed_at: body.completed_at } };
  }

  return { ok: false, error: 'unknown_event' };
}
