import type { CheckContentLite, CheckEventRow, CheckRequest, CheckResult, OutcomeKind, TacticLite } from './types';
import { MAX_BODY_CHARS, validateCheckRequest } from './request';
import { buildResult, parseModelOutput } from './result';
import { buildSystemPrompt, buildUserContent, type ClaudeContent } from './prompt';
import { DAY_MS, decideLimit } from './limits';
import { findCanadianPii } from './ca-patterns';

export type ModelCall = { ok: true; text: string; stop: string | null } | { ok: false; kind: 'timeout' | 'error' };

export interface HandlerDeps {
  now: () => number;
  tactics: TacticLite[];
  content: CheckContentLite;
  model: string;
  apiKey: string | null;
  perAnon: number;
  global: number;
  /** Checks since the given time that reached the model stage. null when the count cannot be read. */
  countChecks: (args: { anonId?: string; sinceIso: string }) => Promise<number | null>;
  /** Writes one check_events row. Must never throw into the caller. */
  recordEvent: (row: CheckEventRow) => Promise<void>;
  callModel: (args: { system: string; content: ClaudeContent[] }) => Promise<ModelCall>;
}

export type HandlerResponse =
  | { status: 200; body: CheckResult }
  | { status: 400; body: { error: 'bad_request'; field: string } }
  | { status: 429; body: { error: 'rate_limited' } }
  | { status: 503; body: { error: 'not_configured' } }
  | { status: 502; body: { error: 'check_failed' } };

/** Masks anything the phone's rules should already have hidden. A second net, so a bug on the phone cannot leak a number. */
export function serverMask(text: string): string {
  const spans = findCanadianPii(text).filter((s) => s.label !== 'name' && s.label !== 'address');
  let out = '';
  let cursor = 0;
  for (const s of spans) {
    out += text.slice(cursor, s.start) + `[${s.label}]`;
    cursor = s.end;
  }
  return out + text.slice(cursor);
}

/**
 * The whole /api/check flow with its parts passed in, so every branch can be tested without a network.
 * Nothing from the message is logged or stored: only a check_events row with counts and outcomes.
 */
export async function handleCheck(rawBody: string, deps: HandlerDeps): Promise<HandlerResponse> {
  if (rawBody.length > MAX_BODY_CHARS) return { status: 400, body: { error: 'bad_request', field: 'body' } };
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return { status: 400, body: { error: 'bad_request', field: 'body' } };
  }
  const v = validateCheckRequest(parsed);
  if (!v.ok) return { status: 400, body: { error: 'bad_request', field: v.field } };
  const req: CheckRequest = v.request;

  const started = deps.now();
  const sinceIso = new Date(started - DAY_MS).toISOString();
  const row = (outcome: OutcomeKind, extra: Partial<CheckEventRow> = {}): CheckEventRow => ({
    anon_id: req.anon_id,
    input_type: req.input_type,
    tactic_id: null,
    signal_level: null,
    outcome,
    redaction_counts: req.redaction_counts,
    user_unhid_count: req.user_unhid_count,
    user_added_count: req.user_added_count,
    still_personal: null,
    model: deps.model,
    latency_ms: null,
    content_version: req.content_version,
    ...extra,
  });

  const [perAnonCount, globalCount] = await Promise.all([
    deps.countChecks({ anonId: req.anon_id, sinceIso }),
    deps.countChecks({ sinceIso }),
  ]);
  if (decideLimit({ perAnonCount, globalCount, perAnon: deps.perAnon, global: deps.global }) !== 'ok') {
    await deps.recordEvent(row('rate_limited'));
    return { status: 429, body: { error: 'rate_limited' } };
  }

  if (!deps.apiKey) {
    await deps.recordEvent(row('model_error'));
    return { status: 503, body: { error: 'not_configured' } };
  }

  const text = req.input_type === 'paste' && req.text !== undefined ? serverMask(req.text) : req.text;
  const call = await deps.callModel({
    system: buildSystemPrompt(deps.tactics),
    content: buildUserContent({ input_type: req.input_type, image: req.image, text, call_answers: req.call_answers }),
  });
  const latency = Math.max(0, Math.round(deps.now() - started));

  if (!call.ok) {
    await deps.recordEvent(row(call.kind === 'timeout' ? 'timeout' : 'model_error', { latency_ms: latency }));
    return { status: 502, body: { error: 'check_failed' } };
  }
  const out = call.stop === 'refusal' || call.stop === 'max_tokens' ? null : parseModelOutput(call.text);
  if (!out) {
    await deps.recordEvent(row('invalid_output', { latency_ms: latency }));
    return { status: 502, body: { error: 'check_failed' } };
  }
  const result = buildResult(out, deps.tactics, deps.content);
  await deps.recordEvent(
    row('ok', { tactic_id: result.tactic_id, signal_level: result.signal_level, still_personal: out.still_personal, latency_ms: latency }),
  );
  return { status: 200, body: result };
}
