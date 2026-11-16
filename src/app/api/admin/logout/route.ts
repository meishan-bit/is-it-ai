import { clearSessionCookie } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export function POST() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Set-Cookie': clearSessionCookie() },
  });
}
