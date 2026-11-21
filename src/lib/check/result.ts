import type { CheckContentLite, CheckResult, SignalLevel, TacticId, TacticLite } from './types';
import { TACTIC_IDS } from './types';

/**
 * Words the model may not put in a clue. Check It never says a message is safe, real or OK, and it never judges
 * by quoting the message, so lines with quotes, long digit runs, @ or links are dropped too.
 */
export const BANNED_IN_CLUES = /\b(safe|safely|real|really|ok|okay|genuine|legit|legitimate|trustworthy)\b/i;

/** At most 3 plain-language clues of 140 characters or fewer. Anything that could echo the message is dropped. */
export function sanitizeEvidence(evidence: unknown): string[] {
  if (!Array.isArray(evidence)) return [];
  const out: string[] = [];
  for (const e of evidence) {
    if (typeof e !== 'string') continue;
    const line = e.trim().replace(/\s+/g, ' ');
    if (line.length === 0 || line.length > 140) continue;
    if (/\d{6,}/.test(line) || line.includes('@') || /https?:|www\./i.test(line)) continue;
    if (/["\u201c\u201d]/.test(line)) continue;
    if (BANNED_IN_CLUES.test(line)) continue;
    out.push(line);
    if (out.length === 3) break;
  }
  return out;
}

export function normalizeTacticId(raw: unknown): TacticId {
  if (typeof raw !== 'string') return 'unknown';
  const hit = TACTIC_IDS.find((t) => t.toLowerCase() === raw.trim().toLowerCase());
  return hit ?? 'unknown';
}

export function normalizeLevel(raw: unknown): SignalLevel | null {
  if (typeof raw !== 'string') return null;
  const v = raw.trim().toLowerCase();
  return v === 'strong' || v === 'some' || v === 'none_found' ? v : null;
}

export interface ModelOutput {
  signal_level: SignalLevel;
  tactic_id: TacticId;
  evidence: string[];
  still_personal: boolean;
}

/** Reads the model's JSON text. Returns null for anything that is not exactly the documented shape. */
export function parseModelOutput(text: string): ModelOutput | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const level = normalizeLevel(o.signal_level);
  if (!level) return null;
  if (typeof o.tactic_id !== 'string') return null;
  if (!Array.isArray(o.evidence)) return null;
  if (typeof o.still_personal !== 'boolean') return null;
  return { signal_level: level, tactic_id: normalizeTacticId(o.tactic_id), evidence: o.evidence.filter((e): e is string => typeof e === 'string'), still_personal: o.still_personal };
}

/**
 * Turns the model's answer into what the phone shows. The safe step and tactic name come from tactics.json,
 * never from the model. A clue the model wrote is used only after sanitizing; known tactics top up from their own red flags.
 */
export function buildResult(out: ModelOutput, tactics: TacticLite[], content: CheckContentLite): CheckResult {
  const byId = new Map(tactics.map((t) => [t.id, t]));
  const evidence = sanitizeEvidence(out.evidence);
  const note = out.still_personal ? content.still_personal : null;
  const realEntry = byId.get('real');

  if (out.signal_level === 'none_found') {
    const clues = [...evidence];
    for (const f of realEntry?.red_flags ?? []) if (clues.length < 2 && !clues.includes(f)) clues.push(f);
    return {
      signal_level: 'none_found',
      tactic_id: 'real',
      tactic_name: null,
      clues: clues.slice(0, 3),
      safe_step: realEntry?.safe_step ?? content.general_step,
      learn_href: '/learn',
      note,
    };
  }

  const known = /^T\d+$/.test(out.tactic_id) ? byId.get(out.tactic_id) : undefined;
  if (!known) {
    return {
      signal_level: out.signal_level,
      tactic_id: 'unknown',
      tactic_name: null,
      clues: evidence,
      safe_step: content.general_step,
      learn_href: '/learn',
      note,
    };
  }
  const clues = [...evidence];
  for (const f of known.red_flags) if (clues.length < 2 && !clues.includes(f) && !/"/.test(f)) clues.push(f);
  const slug = content.learn[out.tactic_id];
  return {
    signal_level: out.signal_level,
    tactic_id: out.tactic_id,
    tactic_name: known.name,
    clues: clues.slice(0, 3),
    safe_step: known.safe_step,
    learn_href: slug ? `/learn/${slug}` : '/learn',
    note,
  };
}
