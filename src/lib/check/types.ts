/** Shared types for Check It. Pure types and constants only, so tests and the browser can both import them. */

export type InputType = 'photo' | 'paste' | 'call';
export type SignalLevel = 'strong' | 'some' | 'none_found';
export type OutcomeKind = 'ok' | 'timeout' | 'rate_limited' | 'model_error' | 'invalid_output';

export const TACTIC_IDS = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'real', 'unknown'] as const;
export type TacticId = (typeof TACTIC_IDS)[number];

export const CALL_KEYS = ['family_trouble', 'official_caller', 'asked_payment', 'secret_or_stay', 'remote_access', 'money_back'] as const;
export type CallKey = (typeof CALL_KEYS)[number];
export type CallAnswer = 'yes' | 'no' | 'not_sure';

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface OcrWord {
  text: string;
  bbox: Box;
  /** 0-based line number, so words can be rejoined into text in reading order. */
  line: number;
}

/** A piece of personal detail found in text. start/end are character offsets, end exclusive. */
export interface Span {
  start: number;
  end: number;
  label: string;
}

export interface TacticLite {
  id: string;
  name: string;
  red_flags: string[];
  safe_step: string;
}

export interface CheckRequest {
  input_type: InputType;
  image?: string;
  text?: string;
  call_answers?: Record<CallKey, CallAnswer>;
  anon_id: string;
  redaction_counts: Record<string, number>;
  user_unhid_count: number;
  user_added_count: number;
  content_version: string;
}

/** The only fields the server sends back. The safe step always comes from tactics.json, never from the model. */
export interface CheckResult {
  signal_level: SignalLevel;
  tactic_id: TacticId;
  tactic_name: string | null;
  clues: string[];
  safe_step: string;
  learn_href: string;
  note: string | null;
}

export interface CheckEventRow {
  anon_id: string;
  input_type: InputType;
  tactic_id: TacticId | null;
  signal_level: SignalLevel | null;
  outcome: OutcomeKind;
  redaction_counts: Record<string, number>;
  user_unhid_count: number;
  user_added_count: number;
  still_personal: boolean | null;
  model: string;
  latency_ms: number | null;
  content_version: string;
  created_at?: string;
}

/** The parts of content/check.json the server needs. */
export interface CheckContentLite {
  general_step: string;
  still_personal: string;
  learn: Record<string, string>;
}
