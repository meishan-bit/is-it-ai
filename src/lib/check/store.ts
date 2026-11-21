import { SupabaseError, normalizeSupabaseUrl, supabaseConfigured } from '../supabase';
import type { CheckEventRow } from './types';

/** Server-side only. Reads and writes check_events with the same service-role key the rest of the app uses. */

const base = () => normalizeSupabaseUrl(process.env.SUPABASE_URL ?? '');
const key = () => process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

async function rest(path: string, init: { method: string; body?: unknown; prefer?: string; headers?: Record<string, string> }): Promise<Response> {
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
    let code: string | null = null;
    try {
      code = ((await res.json()) as { code?: unknown }).code?.toString() ?? null;
    } catch {
      /* not JSON */
    }
    throw new SupabaseError(`Supabase ${init.method} ${path.split('?')[0]} failed: ${res.status}`, res.status, code);
  }
  return res;
}

export const checkStoreConfigured = supabaseConfigured;

/** Writes one check_events row. The participant row goes first, or a first-time user would hit the 23503 error. */
export async function insertCheckEvent(row: CheckEventRow): Promise<void> {
  await rest('participants?on_conflict=anon_id', {
    method: 'POST',
    body: { anon_id: row.anon_id },
    prefer: 'resolution=ignore-duplicates,return=minimal',
  });
  await rest('check_events', { method: 'POST', body: row, prefer: 'return=minimal' });
}

/** How many checks since a time. Rate-limited rows are not counted, so being blocked cannot keep a person blocked. */
export async function countChecks(args: { anonId?: string; sinceIso: string }): Promise<number | null> {
  const q = [`select=id`, `created_at=gte.${encodeURIComponent(args.sinceIso)}`, `outcome=neq.rate_limited`];
  if (args.anonId) q.push(`anon_id=eq.${encodeURIComponent(args.anonId)}`);
  const res = await rest(`check_events?${q.join('&')}`, { method: 'HEAD', prefer: 'count=exact' });
  const range = res.headers.get('content-range') ?? '';
  const m = /\/(\d+)$/.exec(range);
  return m ? parseInt(m[1], 10) : null;
}

/** All check_events for the admin page, in pages of 1000. */
export async function fetchCheckEvents(maxRows = 20000): Promise<CheckEventRow[]> {
  const out: CheckEventRow[] = [];
  for (let from = 0; from < maxRows; from += 1000) {
    const res = await rest('check_events?select=*&order=id.asc', {
      method: 'GET',
      headers: { 'Range-Unit': 'items', Range: `${from}-${from + 999}` },
    });
    const rows = (await res.json()) as CheckEventRow[];
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}
