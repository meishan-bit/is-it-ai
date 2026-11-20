import type { TrackEvent } from './track-validate';

/** Server-side only. Uses plain fetch against Supabase's REST API so there is no extra dependency. */

/** Accepts the project URL with or without a trailing /rest/v1 (fix #12: a URL copied from the API page still works). */
export const normalizeSupabaseUrl = (raw: string): string =>
  raw.trim().replace(/\/+$/, '').replace(/\/rest\/v1$/i, '').replace(/\/+$/, '');

const base = () => normalizeSupabaseUrl(process.env.SUPABASE_URL ?? '');
const key = () => process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

/** A failed Supabase request, with the HTTP status and the Postgres error code when there is one. */
export class SupabaseError extends Error {
  readonly status: number;
  readonly code: string | null;
  constructor(message: string, status: number, code: string | null) {
    super(message);
    this.name = 'SupabaseError';
    this.status = status;
    this.code = code;
  }
}

/**
 * True when the database refused the row itself (a rule such as a missing parent record, a check or a bad value).
 * Sending the same row again can never succeed, so the phone should drop it (fix #13). Postgres classes 22 (data
 * exception) and 23 (integrity constraint) are rule errors. Set-up problems (wrong URL, missing grants, wrong key)
 * are not: those events stay queued so they save once the set-up is fixed.
 */
export function isRuleError(e: unknown): boolean {
  return e instanceof SupabaseError && e.status >= 400 && e.status < 500 && /^2[23]/.test(e.code ?? '');
}

export const supabaseConfigured = (): boolean => Boolean(base() && key());

async function rest(path: string, init: { method: string; body?: unknown; prefer?: string; headers?: Record<string, string> }) {
  const res = await fetch(`${base()}/rest/v1/${path}`, {
    method: init.method,
    headers: {
      apikey: key(),
      Authorization: `Bearer ${key()}`,
      'Content-Type': 'application/json',
      ...(init.prefer ? { Prefer: init.prefer } : {}),
      ...(init.headers ?? {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let code: string | null = null;
    try {
      code = (JSON.parse(text) as { code?: unknown }).code?.toString() ?? null;
    } catch {
      /* not JSON */
    }
    throw new SupabaseError(`Supabase ${init.method} ${path.split('?')[0]} failed: ${res.status} ${text.slice(0, 200)}`, res.status, code);
  }
  return res;
}

const UPSERT = 'resolution=merge-duplicates,return=minimal';

export async function storeEvent(ev: TrackEvent): Promise<void> {
  if (ev.event === 'start') {
    const participant: Record<string, unknown> = { anon_id: ev.anon_id, is_test_code: ev.is_test_code };
    if (ev.age_band) participant.age_band = ev.age_band;
    if (ev.device_type) participant.device_type = ev.device_type;
    await rest('participants?on_conflict=anon_id', { method: 'POST', body: participant, prefer: UPSERT });
    await rest('attempts?on_conflict=attempt_id', {
      method: 'POST',
      prefer: UPSERT,
      body: { ...ev.attempt, anon_id: ev.anon_id },
    });
    return;
  }
  if (ev.event === 'response') {
    await rest('responses?on_conflict=attempt_id,scenario_id', {
      method: 'POST',
      prefer: UPSERT,
      body: { attempt_id: ev.attempt_id, ...ev.response },
    });
    return;
  }
  await rest(`attempts?attempt_id=eq.${encodeURIComponent(ev.attempt_id)}`, {
    method: 'PATCH',
    prefer: 'return=minimal',
    body: { completed_at: ev.completed_at },
  });
}

/** Reads a whole table in pages of 1000 rows (Supabase's default cap). */
export async function fetchTable<T>(table: string, maxRows = 50000): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < maxRows; from += 1000) {
    const res = await rest(`${table}?select=*&order=${table === 'responses' ? 'id' : 'created_at'}.asc`, {
      method: 'GET',
      headers: { 'Range-Unit': 'items', Range: `${from}-${from + 999}` },
    });
    const rows = (await res.json()) as T[];
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}
