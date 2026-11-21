import { CALL_KEYS, type CallAnswer, type CallKey, type CheckRequest, type InputType } from './types';
import { sanitizeCounts } from './labels';

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const MAX_TEXT_CHARS = 4000;
export const MAX_BODY_CHARS = 3_200_000;

const ANON = /^[A-Za-z0-9_-]{1,64}$/;
const VERSION = /^[0-9A-Za-z.\-+]{1,32}$/;
const B64 = /^[A-Za-z0-9+/]+={0,2}$/;
const PNG_MAGIC = 'iVBORw0KGgo';
const ANSWERS: CallAnswer[] = ['yes', 'no', 'not_sure'];

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const count = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 1000 ? v : null);

export type RequestResult = { ok: true; request: CheckRequest } | { ok: false; field: string };

/** Checks everything the phone sends. Error results name the field only, never the value. */
export function validateCheckRequest(body: unknown): RequestResult {
  if (!isObj(body)) return { ok: false, field: 'body' };
  const it = body.input_type;
  if (it !== 'photo' && it !== 'paste' && it !== 'call') return { ok: false, field: 'input_type' };
  const input_type: InputType = it;
  if (typeof body.anon_id !== 'string' || !ANON.test(body.anon_id)) return { ok: false, field: 'anon_id' };
  if (typeof body.content_version !== 'string' || !VERSION.test(body.content_version)) return { ok: false, field: 'content_version' };
  const unhid = body.user_unhid_count === undefined ? 0 : count(body.user_unhid_count);
  const added = body.user_added_count === undefined ? 0 : count(body.user_added_count);
  if (unhid === null) return { ok: false, field: 'user_unhid_count' };
  if (added === null) return { ok: false, field: 'user_added_count' };

  const base = {
    input_type,
    anon_id: body.anon_id,
    content_version: body.content_version,
    redaction_counts: sanitizeCounts(body.redaction_counts),
    user_unhid_count: unhid,
    user_added_count: added,
  };

  if (input_type === 'photo') {
    const img = body.image;
    if (typeof img !== 'string' || img.length === 0) return { ok: false, field: 'image' };
    if (!B64.test(img) || !img.startsWith(PNG_MAGIC)) return { ok: false, field: 'image' };
    const bytes = Math.floor((img.length * 3) / 4) - (img.endsWith('==') ? 2 : img.endsWith('=') ? 1 : 0);
    if (bytes > MAX_IMAGE_BYTES) return { ok: false, field: 'image' };
    return { ok: true, request: { ...base, image: img } };
  }

  if (input_type === 'paste') {
    const t = body.text;
    if (typeof t !== 'string' || t.trim().length === 0 || t.length > MAX_TEXT_CHARS) return { ok: false, field: 'text' };
    return { ok: true, request: { ...base, text: t } };
  }

  const a = body.call_answers;
  if (!isObj(a)) return { ok: false, field: 'call_answers' };
  const keys = Object.keys(a);
  if (keys.length !== CALL_KEYS.length || !CALL_KEYS.every((k) => keys.includes(k))) return { ok: false, field: 'call_answers' };
  const answers = {} as Record<CallKey, CallAnswer>;
  for (const k of CALL_KEYS) {
    const v = a[k];
    if (typeof v !== 'string' || !ANSWERS.includes(v as CallAnswer)) return { ok: false, field: 'call_answers' };
    answers[k] = v as CallAnswer;
  }
  return { ok: true, request: { ...base, call_answers: answers } };
}
