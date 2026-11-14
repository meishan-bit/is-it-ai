import { adminConfigured, isAuthenticated } from '@/lib/admin-auth';
import { loadAdminDataset, SCENARIO_META } from '@/lib/admin-data';
import { aggregate } from '@/lib/analytics';
import { APP_VERSION, CONTENT_VERSION, GIT_COMMIT } from '@/lib/version';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!adminConfigured()) return Response.json({ error: 'admin_not_configured' }, { status: 503 });
  if (!isAuthenticated(req)) return Response.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const d = await loadAdminDataset();
    const stats = aggregate(d.participants, d.attempts, d.responses, SCENARIO_META);
    return Response.json({ mode: d.mode, stats, versions: { app: APP_VERSION, content: CONTENT_VERSION, commit: GIT_COMMIT } });
  } catch (e) {
    console.error('admin data failed', e instanceof Error ? e.message : e);
    return Response.json({ error: 'data_failed' }, { status: 502 });
  }
}
