import { adminConfigured, createSessionCookie, passcodeMatches } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

// Best-effort throttle (per server instance): 8 wrong tries per 15 minutes per address.
const tries = new Map<string, { n: number; first: number }>();

export async function POST(req: Request) {
  if (!adminConfigured()) return Response.json({ error: 'admin_not_configured' }, { status: 503 });
  const ip = (req.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim();
  const now = Date.now();
  const t = tries.get(ip);
  if (t && now - t.first < 15 * 60_000 && t.n >= 8) return Response.json({ error: 'too_many_tries' }, { status: 429 });

  let passcode = '';
  try {
    const body = (await req.json()) as { passcode?: unknown };
    passcode = typeof body.passcode === 'string' ? body.passcode : '';
  } catch {
    /* fall through to wrong passcode */
  }
  if (!passcodeMatches(passcode)) {
    const fresh = t && now - t.first < 15 * 60_000 ? { n: t.n + 1, first: t.first } : { n: 1, first: now };
    tries.set(ip, fresh);
    await new Promise((r) => setTimeout(r, 600));
    return Response.json({ error: 'wrong_passcode' }, { status: 401 });
  }
  tries.delete(ip);
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Set-Cookie': createSessionCookie() },
  });
}
