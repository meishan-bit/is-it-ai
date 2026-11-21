/**
 * The fixed list of labels that may appear in check_events.redaction_counts.
 * Nine Canadian rules (card number, expiry and security code come from one rule) plus name, address and photo.
 * The server drops any other key, so no value from a message can slip into the database through a count.
 */
export const REDACTION_LABELS = [
  'id number',
  'postal code',
  'health card number',
  'phone number',
  'card number',
  'card expiry',
  'card security code',
  'code or pin',
  'email name',
  'link code',
  'birth date',
  'name',
  'address',
  'photo',
] as const;

export type RedactionLabel = (typeof REDACTION_LABELS)[number];

const ALLOWED = new Set<string>(REDACTION_LABELS);
export const isRedactionLabel = (s: string): s is RedactionLabel => ALLOWED.has(s);

/** Keeps only allowed labels with whole-number counts from 1 to 999. Anything else is dropped. */
export function sanitizeCounts(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!ALLOWED.has(k)) continue;
    if (typeof v !== 'number' || !Number.isFinite(v)) continue;
    const n = Math.floor(v);
    if (n >= 1 && n <= 999) out[k] = n;
  }
  return out;
}
