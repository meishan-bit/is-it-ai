'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import ScreenHeader from './ScreenHeader';
import { PRACTICE_POOL, TACTICS, getScenario } from '@/lib/content';
import { isExampleRight } from '@/lib/scoring';
import { clearProgress, getAttempts } from '@/lib/storage';
import type { AttemptRecord } from '@/lib/types';

type Level = { label: string; cls: string };

function levelFor(n: number, rightPct: number | null, hasPractice: boolean): Level {
  if (!hasPractice) return { label: 'Learn the signs', cls: 'soft' };
  if (n === 0 || rightPct === null) return { label: 'Not practised yet', cls: '' };
  if (n >= 2 && rightPct >= 80) return { label: 'Confident', cls: 'strong' };
  if (rightPct >= 50) return { label: 'Getting there', cls: 'soft' };
  return { label: 'Keep practising', cls: 'try' };
}

export default function ProgressDashboard() {
  const [attempts, setAttempts] = useState<AttemptRecord[] | null>(null);

  useEffect(() => setAttempts(getAttempts().filter((a) => a.mode === 'practice')), []);
  if (!attempts) return null;

  const done = attempts.filter((a) => a.completed_at);
  const responses = attempts.flatMap((a) => a.responses);
  const right = responses.filter(isExampleRight).length;
  const pct = responses.length ? Math.round((right / responses.length) * 100) : null;
  const recent = done.slice().sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? '')).slice(0, 5);

  const perTactic = TACTICS.map((t) => {
    const rs = responses.filter((r) => getScenario(r.scenario_id)?.tactic === t.id);
    const ok = rs.filter(isExampleRight).length;
    const hasPractice = PRACTICE_POOL.some((s) => s.tactic === t.id);
    const p = rs.length ? Math.round((ok / rs.length) * 100) : null;
    return { t, n: rs.length, p, hasPractice, level: levelFor(rs.length, p, hasPractice) };
  });

  const speech = `My progress. You have finished ${done.length} rounds and practised ${responses.length} examples.`;

  return (
    <div className="page">
      <ScreenHeader listenText={speech} />
      <h1>My progress</h1>

      {responses.length === 0 ? (
        <div className="card">
          <p className="lead" style={{ marginBottom: 12 }}>You have not practised yet. Your progress will show here.</p>
          <div className="btn-row"><Link href="/practice" className="btn">Start practising</Link></div>
        </div>
      ) : (
        <div className="stat-grid">
          <div className="stat"><div className="num">{done.length}</div><div className="lbl">{done.length === 1 ? 'round' : 'rounds'} finished</div></div>
          <div className="stat"><div className="num">{responses.length}</div><div className="lbl">{responses.length === 1 ? 'example' : 'examples'} practised</div></div>
          <div className="stat"><div className="num">{pct}%</div><div className="lbl">spotted and handled safely</div></div>
        </div>
      )}

      <h2>Five simple rules</h2>
      <div className="card">
        <ol className="rules">
          <li><span><strong>Pause.</strong> Scammers want you to hurry. A rush is a warning sign.</span></li>
          <li><span><strong>Do not click or call</strong> the link or number in a surprise message.</span></li>
          <li><span><strong>Check another way</strong> with a number or website you already know.</span></li>
          <li><span><strong>Watch for secrets.</strong> “Do not tell anyone” is a warning sign.</span></li>
          <li><span><strong>Talk to someone you trust</strong> before you send money or details.</span></li>
        </ol>
        <p className="muted" style={{ margin: '14px 0 0' }}>
          Not sure? The Canadian Anti-Fraud Centre is at 1-888-495-8501.
        </p>
      </div>

      <h2>Scam types</h2>
      <p className="muted">Tap a type to see its signs and the safe step.</p>
      {perTactic.map(({ t, n, p, level, hasPractice }) => (
        <details className="tactic" key={t.id}>
          <summary>
            <span>{t.name}</span>
            <span className={`chip ${level.cls}`}>{level.label}</span>
          </summary>
          <div className="body">
            <p className="muted">Arrives by: {t.arrives_by}</p>
            <h3>Signs to watch for</h3>
            <ul className="flags">{t.red_flags.map((f) => <li key={f}>{f}</li>)}</ul>
            <div className="todo"><h3>Safe step</h3><p>{t.safe_step}</p></div>
            {hasPractice && n > 0 && p !== null && (
              <p className="muted">You have practised this {n} {n === 1 ? 'time' : 'times'} and handled it well {p}% of the time.</p>
            )}
            {!hasPractice && <p className="muted">This one appears in the research check, not in practice rounds.</p>}
          </div>
        </details>
      ))}

      {recent.length > 0 && (
        <>
          <h2>Recent rounds</h2>
          <div className="card">
            <ul className="checks" style={{ margin: 0 }}>
              {recent.map((a) => {
                const ok = a.responses.filter(isExampleRight).length;
                return (
                  <li key={a.attempt_id}>
                    <span>
                      {new Date(a.completed_at as string).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}:{' '}
                      <strong>{ok} of {a.responses.length}</strong> right
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}

      <div className="btn-row">
        <Link href="/practice" className="btn">Practise</Link>
        {responses.length > 0 && (
          <button
            type="button"
            className="btn btn-quiet"
            onClick={() => {
              if (window.confirm('Clear your practice history on this device?')) {
                clearProgress();
                setAttempts([]);
              }
            }}
          >
            Clear my progress on this device
          </button>
        )}
      </div>
    </div>
  );
}
