'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { TACTICS } from '@/lib/content';
import type { AdminStats } from '@/lib/analytics';

interface Payload {
  mode: 'live' | 'sample';
  stats: AdminStats;
  versions: { app: string; content: string; commit: string };
}
type View = 'loading' | 'login' | 'disabled' | 'error' | 'ready';

const tacticName = (id: string) => TACTICS.find((t) => t.id === id)?.name ?? id;
const fmt = (n: number | null, suffix = '') => (n === null ? '-' : `${n}${suffix}`);
const signed = (n: number | null, suffix = '') => (n === null ? '-' : `${n > 0 ? '+' : ''}${n}${suffix}`);

function Bar({ label, value, alt = false }: { label: string; value: number | null; alt?: boolean }) {
  const v = value === null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <div className="barrow">
      <span title={label}>{label}</span>
      <div className={`bar${alt ? ' alt' : ''}`} role="img" aria-label={`${label}: ${value === null ? 'no data' : value + ' percent'}`}>
        <span style={{ width: `${v}%` }} />
      </div>
      <span>{value === null ? '-' : `${value}%`}</span>
    </div>
  );
}

export default function AdminDashboard() {
  const [view, setView] = useState<View>('loading');
  const [data, setData] = useState<Payload | null>(null);
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/data', { cache: 'no-store' });
      if (res.status === 503) return setView('disabled');
      if (res.status === 401) return setView('login');
      if (!res.ok) return setView('error');
      setData((await res.json()) as Payload);
      setView('ready');
    } catch {
      setView('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode }),
    });
    if (res.ok) {
      setPasscode('');
      setView('loading');
      await load();
    } else if (res.status === 429) setError('Too many tries. Please wait a few minutes.');
    else setError('That passcode did not work.');
  }

  async function logout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    setData(null);
    setView('login');
  }

  if (view === 'loading') return <div className="page admin"><p>Loading…</p></div>;

  if (view === 'disabled')
    return (
      <div className="page admin">
        <h1>Admin dashboard is switched off</h1>
        <p>Set the <code>ADMIN_PASSCODE</code> environment variable (see the README), redeploy, and this page will ask for it.</p>
        <p><Link href="/">Back to the app</Link></p>
      </div>
    );

  if (view === 'error')
    return (
      <div className="page admin">
        <h1>Could not load the dashboard</h1>
        <p>Check the Supabase settings and try again.</p>
        <button type="button" className="btn" onClick={() => { setView('loading'); void load(); }}>Try again</button>
      </div>
    );

  if (view === 'login')
    return (
      <div className="page admin">
        <h1>Admin sign in</h1>
        <form onSubmit={login} style={{ maxWidth: 420 }}>
          {error && <p className="error-text" role="alert">{error}</p>}
          <div className="field">
            <label htmlFor="pass">Passcode</label>
            <input id="pass" type="password" autoComplete="current-password" value={passcode} onChange={(e) => setPasscode(e.target.value)} />
          </div>
          <button type="submit" className="btn">Sign in</button>
        </form>
      </div>
    );

  if (!data) return null;
  const { stats, mode, versions } = data;
  const t = stats.testing;
  const p = stats.practice;
  const maxAct = Math.max(1, ...stats.activity.map((a) => a.practice + a.test));
  const hardest = stats.by_scenario.filter((s) => s.both_pct !== null).slice().sort((a, b) => (a.both_pct as number) - (b.both_pct as number)).slice(0, 8);

  return (
    <div className="page page-wide admin">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center', margin: '8px 0 14px' }}>
        <h1 style={{ margin: 0 }}>Training results</h1>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-secondary" onClick={() => { setView('loading'); void load(); }}>Refresh</button>
          <a className="btn btn-secondary" href="/api/admin/export">Download responses (CSV)</a>
          <button type="button" className="btn btn-quiet" onClick={logout}>Sign out</button>
        </div>
      </div>

      {mode === 'sample' ? (
        <div className="banner" role="status">
          Sample data. This is made-up data so you can see the layout. Connect Supabase (see the README) and the real results appear here.
        </div>
      ) : (
        <div className="banner live" role="status">
          Live data from Supabase · updated {new Date(stats.generated_at).toLocaleString('en-CA')} · app v{versions.app} · content {versions.content}
        </div>
      )}

      <div className="kpis">
        <div className="kpi"><div className="num">{stats.totals.learners}</div><div className="lbl">Learners who practised</div><div className="sub">{p.rounds_per_learner ?? '-'} rounds each on average</div></div>
        <div className="kpi"><div className="num">{fmt(p.completion_rate, '%')}</div><div className="lbl">Practice rounds finished</div><div className="sub">{p.completed} of {p.attempts} started</div></div>
        <div className="kpi"><div className="num">{fmt(p.avg_round_score_pct, '%')}</div><div className="lbl">Average practice score</div><div className="sub">verdict and safe step both right</div></div>
        <div className="kpi"><div className="num">{t.completed_both}/{t.testers}</div><div className="lbl">Testers who finished both checks</div><div className="sub">{fmt(t.completion_rate, '%')} completion</div></div>
        <div className="kpi"><div className="num">{signed(t.avg_change_pp, ' pp')}</div><div className="lbl">Average improvement, before to after</div><div className="sub">{signed(t.avg_change_points, ' points')} out of 10</div></div>
        <div className="kpi"><div className="num">{fmt(p.avg_seconds_per_example, ' s')}</div><div className="lbl">Time per practice example</div><div className="sub">not scored</div></div>
      </div>

      <section className="card" aria-labelledby="success">
        <h2 id="success">Did the training work?</h2>
        {t.target_met === null ? (
          <p className="goal miss">Not enough finished before-and-after pairs yet. The goal is an average improvement of {t.target_pp} percentage points (about 2 extra points out of 10).</p>
        ) : (
          <p className={`goal${t.target_met ? '' : ' miss'}`}>
            {t.target_met ? '✔ Goal reached: ' : '➜ Not at the goal yet: '}
            average improvement {signed(t.avg_change_pp, ' percentage points')} (goal: {t.target_pp}). {t.improved} of {t.completed_both} testers improved.
          </p>
        )}
        <p className="muted">
          The goal is exploratory, not guaranteed. With 3 to 5 testers, read each person’s change on its own and the average as a rough guide. No significance tests.
        </p>
        <div className="tablewrap">
          <table>
            <thead><tr><th>Tester</th><th>Order</th><th>Before</th><th>After</th><th>Change</th></tr></thead>
            <tbody>
              {t.rows.length === 0 && <tr><td colSpan={5}>No test sessions yet.</td></tr>}
              {t.rows.map((r) => (
                <tr key={r.anon_id}>
                  <td>{r.anon_id}</td>
                  <td>{r.pre_form ?? '-'} then {r.post_form ?? '-'}</td>
                  <td>{r.pre_points === null ? 'not finished' : `${r.pre_points}/${r.max}`}</td>
                  <td>{r.post_points === null ? 'not finished' : `${r.post_points}/${r.max}`}</td>
                  <td><strong>{signed(r.change_points, ' pts')}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {t.completed_both > 0 && (
          <div style={{ marginTop: 14 }}>
            <Bar label="Average before" value={t.avg_pre_pct} alt />
            <Bar label="Average after" value={t.avg_post_pct} />
          </div>
        )}
      </section>

      <div className="grid2">
        <section className="card" aria-labelledby="tactics">
          <h2 id="tactics">Accuracy by scam type</h2>
          <p className="muted">Share of answers where both the verdict and the safe step were right.</p>
          {stats.by_tactic.length === 0 && <p>No answers yet.</p>}
          {stats.by_tactic.map((x) => (
            <Bar key={x.tactic} label={`${x.tactic === 'real' ? 'Genuine' : x.tactic} ${tacticName(x.tactic)} (${x.responses})`} value={x.both_pct} />
          ))}
        </section>

        <section className="card" aria-labelledby="hardest">
          <h2 id="hardest">Hardest examples</h2>
          <div className="tablewrap">
            <table>
              <thead><tr><th>Example</th><th>Type</th><th>Answers</th><th>Right</th><th>Safe step</th><th>Avg time</th></tr></thead>
              <tbody>
                {hardest.length === 0 && <tr><td colSpan={6}>No answers yet.</td></tr>}
                {hardest.map((s) => (
                  <tr key={s.id}>
                    <td>{s.id}{s.use === 'practice' ? '' : ' (test)'}</td>
                    <td>{s.tactic}</td>
                    <td>{s.responses}</td>
                    <td>{fmt(s.both_pct, '%')}</td>
                    <td>{fmt(s.step_pct, '%')}</td>
                    <td>{fmt(s.avg_seconds, ' s')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card" aria-labelledby="pairs">
          <h2 id="pairs">Are Form A and Form B equally hard?</h2>
          <p className="muted">Each pair compares the twin examples. A gap over 15 points deserves a look (needs 5 or more answers per item).</p>
          <div className="tablewrap">
            <table>
              <thead><tr><th>Pair</th><th>Form A</th><th>Form B</th><th>Gap</th><th>Status</th></tr></thead>
              <tbody>
                {stats.pairs.map((r) => (
                  <tr key={r.pair}>
                    <td>{r.pair}</td>
                    <td>{r.a_id}: {fmt(r.a_pct, '%')} (n={r.a_n})</td>
                    <td>{r.b_id}: {fmt(r.b_pct, '%')} (n={r.b_n})</td>
                    <td>{signed(r.diff_pp, ' pp')}</td>
                    <td>{r.status === 'too_few' ? 'Too few answers' : r.status === 'similar' ? '✔ Similar' : '➜ Check'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card" aria-labelledby="activity">
          <h2 id="activity">Activity, last 14 days</h2>
          <div className="spark" role="img" aria-label={`Rounds and tests started each day for the last 14 days. Busiest day: ${maxAct}.`}>
            {stats.activity.map((a) => (
              <div className="col" key={a.date} title={`${a.date}: ${a.practice} practice, ${a.test} test`}>
                <span className="t" style={{ height: `${(a.test / maxAct) * 100}%` }} />
                <span style={{ height: `${(a.practice / maxAct) * 100}%` }} />
              </div>
            ))}
          </div>
          <div className="legend"><span><i />Practice rounds</span><span><i className="t" />Test parts</span></div>
          <p className="muted">{stats.activity[0]?.date} to {stats.activity[stats.activity.length - 1]?.date}</p>
        </section>

        <section className="card" aria-labelledby="who">
          <h2 id="who">Who and what</h2>
          <h3>Devices</h3>
          <ul className="flags">{stats.by_device.map((d) => <li key={d.label}>{d.label}: {d.count}</li>)}</ul>
          <h3>Testers by age group</h3>
          <ul className="flags">{stats.by_age.length === 0 ? <li>No testers yet</li> : stats.by_age.map((d) => <li key={d.label}>{d.label}: {d.count}</li>)}</ul>
          <h3>App and content versions</h3>
          <ul className="flags">{stats.by_version.map((d) => <li key={d.label}>{d.label}: {d.attempts} attempts</li>)}</ul>
        </section>
      </div>
    </div>
  );
}
