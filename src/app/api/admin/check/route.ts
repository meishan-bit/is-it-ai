import { adminConfigured, isAuthenticated } from '@/lib/admin-auth';
import { aggregateChecks, buildSampleChecks } from '@/lib/check/check-stats';
import { checkStoreConfigured, fetchCheckEvents } from '@/lib/check/store';

export const dynamic = 'force-dynamic';

/** Check It numbers for the admin page: counts, outcomes and timings only. There is no message content to return. */
export async function GET(req: Request) {
  if (!adminConfigured()) return Response.json({ error: 'admin_not_configured' }, { status: 503 });
  if (!isAuthenticated(req)) return Response.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const live = checkStoreConfigured();
    const rows = live ? await fetchCheckEvents() : buildSampleChecks();
    return Response.json({ mode: live ? 'live' : 'sample', stats: aggregateChecks(rows) });
  } catch (e) {
    console.error('admin check data failed', e instanceof Error ? e.name : 'error');
    return Response.json({ error: 'data_failed' }, { status: 502 });
  }
}
