'use client';

import './check.css';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { CheckStats } from '@/lib/check/check-stats';
import { TACTICS } from '@/lib/content';

type View = 'loading' | 'login' | 'disabled' | 'error' | 'ready';
const fmt = (n: number | null, suffix = '') => (n === null ? '-' : `${n}${suffix}`);
const NAMES: Record<string, string> = {
  photo: 'Photo or screenshot', paste: 'Pasted message', call: 'Phone call',
  strong: 'Strong warning signs', some: 'Some warning signs', none_found: 'No common warning signs',
  ok: 'Finished', timeout: 'Timed out', rate_limited: 'Too many checks', model_error: 'Model error', invalid_output: 'Unreadable answer',
};
const labelFor = (k: string) => {
  if (NAMES[k]) return NAMES[k];
  if (k === 'real') return 'Genuine message';
  if (k === 'unknown') return 'No match';
  const t = TACTICS.find((x) => x.id === k);
  return t ? `${k} ${t.name}` : k;
};

function Bars({ rows, total }: { rows: Array<{ label: string; count: number }>; total: number }) {
  if (rows.length === 0) return <p>No checks yet.</p>;
  return (
    <>
      {rows.map((r) => {
        const pct = total ? Math.round((r.count / total) * 100) : 0;
        return (
          <div className="barrow" key={r.label}>
            <span>{labelFor(r.label)}</span>
            <div className="bar" role="img" aria-label={`${labelFor(r.label)}: ${r.count} checks`}><span style={{ width: `${pct}%` }} /></div>
            <span>{r.count}</span>
          </div>
        );
      })}
    </>
  );
}

/** Check It results for the admin. Counts and timings only: nothing from any message is stored, so none can be shown. */
export default function CheckAdminPanel() {
  const [view, setView] = useState<View>('loading');
  const [data, setData] = useState<{ mode: 'live' | 'sample'; stats: CheckStats } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/check', { cache: 'no-store' });
      if (res.status === 503) return setView('disabled');
      if (res.status === 401) return setView('login');
      if (!res.ok) return setView('error');
      setData((await res.json()) as { mode: 'live' | 'sample'; stats: CheckStats });
      setView('ready');
    } catch {
      setView('error');
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  if (view === 'loading') return <div className="page admin"><p>Loading…</p></div>;
  if (view === 'disabled')
    return <div className="page admin"><h1>Admin dashboard is switched off</h1><p>Set <code>ADMIN_PASSCODE</code> first (see the README).</p></div>;
  if (view === 'login')
    return <div className="page admin"><h1>Please sign in first</h1><p><Link href="/admin">Go to the admin sign-in</Link>, then come back to Check It results.</p></div>;
  if (view === 'error' || !data)
    return <div className="page admin"><h1>Could not load Check It results</h1><button type="button" className="btn" onClick={() => { setView('loading'); void load(); }}>Try again</button></div>;

  const s = data.stats;
  return (
    <div className="page page-wide admin">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center', margin: '8px 0 14px' }}>
        <h1 style={{ margin: 0 }}>Check It results</h1>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link className="btn btn-secondary" href="/admin">Training results</Link>
          <button type="button" className="btn btn-secondary" onClick={() => { setView('loading'); void load(); }}>Refresh</button>
        </div>
      </div>
      {data.mode === 'sample' ? (
        <div className="banner" role="status">Sample data. Connect Supabase and run the check_events SQL (see docs/CHECK_IT.md) and the real counts appear here.</div>
      ) : (
        <div className="banner live" role="status">Live data from Supabase. Counts only: no message, picture or answer text is stored.</div>
      )}
      <div className="kpis">
        <div className="kpi"><div className="num">{s.total}</div><div className="lbl">Checks started</div><div className="sub">{s.checks_ok} finished, {s.failed} did not</div></div>
        <div className="kpi"><div className="num">{fmt(s.median_latency_ms, ' ms')}</div><div className="lbl">Median time to a result</div></div>
        <div className="kpi"><div className="num">{fmt(s.unhid_share_pct, '%')}</div><div className="lbl">Showed a hidden detail</div><div className="sub">photo and paste checks</div></div>
        <div className="kpi"><div className="num">{fmt(s.added_share_pct, '%')}</div><div className="lbl">Hid extra words</div><div className="sub">photo and paste checks</div></div>
        <div className="kpi"><div className="num">{fmt(s.still_personal_pct, '%')}</div><div className="lbl">Personal details still showing</div><div className="sub">flagged by the second check</div></div>
      </div>
      <div className="grid2">
        <section className="card" aria-labelledby="c-in"><h2 id="c-in">By way in</h2><Bars rows={s.by_input_type} total={s.total} /></section>
        <section className="card" aria-labelledby="c-lv"><h2 id="c-lv">By result</h2><Bars rows={s.by_signal_level} total={s.checks_ok} /></section>
        <section className="card" aria-labelledby="c-tc"><h2 id="c-tc">By scam type</h2><Bars rows={s.by_tactic} total={s.checks_ok} /></section>
        <section className="card" aria-labelledby="c-oc"><h2 id="c-oc">Outcomes</h2><Bars rows={s.by_outcome} total={s.total} /></section>
      </div>
    </div>
  );
}
