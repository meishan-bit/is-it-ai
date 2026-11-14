import type { TrackEvent } from './track-validate';

/** Server-side only. Uses plain fetch against Supabase's REST API so there is no extra dependency. */

const base = () => (process.env.SUPABASE_URL ?? '').replace(/\/+$/, '');
const key = () => process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

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
    throw new Error(`Supabase ${init.method} ${path.split('?')[0]} failed: ${res.status} ${text.slice(0, 200)}`);
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
