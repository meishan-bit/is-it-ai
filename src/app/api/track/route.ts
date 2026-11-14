import { SCENARIOS } from '@/lib/content';
import { evaluate } from '@/lib/scoring';
import { storeEvent, supabaseConfigured } from '@/lib/supabase';
import { validateTrackEvent } from '@/lib/track-validate';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: 'bad_json' }, { status: 400 });
  }
  const v = validateTrackEvent(body, (id) => SCENARIOS.find((s) => s.id === id), evaluate);
  if (!v.ok) return Response.json({ ok: false, error: v.error }, { status: 400 });
  // Without Supabase the app still works: answers stay on the device.
  if (!supabaseConfigured()) return Response.json({ ok: true, stored: false });
  try {
    await storeEvent(v.event);
    return Response.json({ ok: true, stored: true });
  } catch (e) {
    console.error('track store failed', e instanceof Error ? e.message : e);
    return Response.json({ ok: false, error: 'store_failed' }, { status: 502 });
  }
}
