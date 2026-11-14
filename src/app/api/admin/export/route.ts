import { adminConfigured, isAuthenticated } from '@/lib/admin-auth';
import { loadAdminDataset } from '@/lib/admin-data';
import { responsesToCsv } from '@/lib/csv';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!adminConfigured()) return Response.json({ error: 'admin_not_configured' }, { status: 503 });
  if (!isAuthenticated(req)) return Response.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const d = await loadAdminDataset();
    const csv = responsesToCsv(d.attempts, d.responses);
    const day = new Date().toISOString().slice(0, 10);
    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="is-it-ai-${d.mode}-responses-${day}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return Response.json({ error: 'export_failed' }, { status: 502 });
  }
}
