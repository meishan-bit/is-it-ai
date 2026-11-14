'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import ItemRunner from './ItemRunner';
import ScreenHeader from './ScreenHeader';
import { SCENARIOS, getScenario, getTactic } from '@/lib/content';
import { formForStage, formOrder, itemsForForm, nextStageAfter, parseTestCode } from '@/lib/forms';
import { scoreResponses } from '@/lib/scoring';
import { getAttempt, getSession, setSession } from '@/lib/storage';
import { attemptsToCsv, completeAttempt, flushOutbox, recordResponse, startAttempt } from '@/lib/tracker';
import type { AttemptRecord, ResponseRecord, Scenario, TestSession } from '@/lib/types';

const BANDS = [
  { value: '', label: 'Choose (optional)' },
  { value: '60-69', label: '60 to 69' },
  { value: '70-79', label: '70 to 79' },
  { value: '80+', label: '80 or older' },
  { value: 'prefer-not-to-say', label: 'I would rather not say' },
];

export default function TestFlow() {
  const [ready, setReady] = useState(false);
  const [session, setSessionState] = useState<TestSession | null>(null);
  const [code, setCode] = useState('');
  const [band, setBand] = useState('');
  const [error, setError] = useState('');
  const [items, setItems] = useState<Scenario[]>([]);
  const [idx, setIdx] = useState(0);
  const [intro, setIntro] = useState(true);
  const attemptRef = useRef('');

  useEffect(() => {
    void flushOutbox();
    setSessionState(getSession());
    setReady(true);
  }, []);

  // Whenever the tester enters a "before" or "after" part, get the right five examples ready and pick up where they left off.
  const stage = session?.stage;
  const sessionCode = session?.code;
  useEffect(() => {
    const s = getSession();
    if (!s || (s.stage !== 'pre' && s.stage !== 'post')) return;
    const form = formForStage(s.order, s.stage);
    const list = itemsForForm(SCENARIOS, form, s.code);
    const key = s.stage === 'pre' ? 'pre_attempt_id' : 'post_attempt_id';
    let attempt = s[key] ? getAttempt(s[key] as string) : undefined;
    if (!attempt) {
      attempt = startAttempt({ mode: s.stage, form, anonId: s.code, ageBand: s.age_band, isTestCode: true });
      setSession({ ...s, [key]: attempt.attempt_id });
    }
    attemptRef.current = attempt.attempt_id;
    setItems(list);
    const done = Math.min(attempt.responses.length, list.length);
    setIdx(done);
    setIntro(done === 0);
  }, [stage, sessionCode]);

  function begin(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseTestCode(code);
    if (!parsed) {
      setError('Please type the code from your session sheet, for example T1.');
      return;
    }
    const s: TestSession = {
      code: parsed.code,
      order: formOrder(parsed.n),
      stage: 'pre',
      age_band: band || null,
      pre_attempt_id: null,
      post_attempt_id: null,
      started_at: new Date().toISOString(),
    };
    setSession(s);
    setSessionState(s);
    setError('');
  }

  function advance() {
    const s = getSession();
    if (!s) return;
    const upd: TestSession = { ...s, stage: nextStageAfter(s.stage) };
    setSession(upd);
    setItems([]);
    setIdx(0);
    setIntro(true);
    setSessionState(upd);
  }

  function endSession() {
    setSession(null);
    window.location.href = '/';
  }

  if (!ready) return null;

  // ---------------------------------------------------------------- start
  if (!session) {
    return (
      <div className="page">
        <ScreenHeader listenText="Test session. Type the code from your session sheet, then press Start." />
        <h1>Test session</h1>
        <p className="lead">
          This is for people taking part in the research sessions. Your helper will give you a short code, like T1.
        </p>
        <form onSubmit={begin} noValidate>
          {error && <p className="error-text" role="alert">{error}</p>}
          <div className="field">
            <label htmlFor="code">Your code</label>
            <input id="code" type="text" inputMode="text" autoCapitalize="characters" autoComplete="off" value={code}
              onChange={(e) => setCode(e.target.value)} placeholder="T1" />
          </div>
          <div className="field">
            <label htmlFor="band">Your age group</label>
            <select id="band" value={band} onChange={(e) => setBand(e.target.value)}>
              {BANDS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
            </select>
          </div>
          <div className="btn-row">
            <button type="submit" className="btn">Start</button>
          </div>
        </form>
        <p className="muted">No names are saved. Only the code and your answers are kept.</p>
      </div>
    );
  }

  // ---------------------------------------------------------------- before / after parts
  if (session.stage === 'pre' || session.stage === 'post') {
    const isPre = session.stage === 'pre';
    if (items.length === 0) return null;
    if (intro && idx === 0) {
      const text = isPre
        ? 'Part 1. You will see five examples. Choose the answer you think is best. You will not be told if you are right until the very end.'
        : 'Final check. You will see five more examples. Choose the answer you think is best. You will see all the explanations at the end.';
      return (
        <div className="page">
          <ScreenHeader stop listenText={text} />
          <h1>{isPre ? 'Part 1: before you practise' : 'Final check'}</h1>
          <p className="lead">
            {isPre ? 'You will see five examples.' : 'You will see five more examples.'} Choose the answer you think is best.
          </p>
          <p>
            There are no wrong feelings here. {isPre ? 'You will not be told if you are right until the very end.' : 'You will see all the explanations at the end.'}
          </p>
          <div className="btn-row">
            <button type="button" className="btn" onClick={() => setIntro(false)}>Start</button>
          </div>
        </div>
      );
    }
    const scenario = items[Math.min(idx, items.length - 1)];
    return (
      <ItemRunner
        key={scenario.id}
        scenario={scenario}
        index={idx}
        total={items.length}
        mode="test"
        seed={session.code}
        isLast={idx === items.length - 1}
        onAnswered={(r: ResponseRecord) => {
          recordResponse(attemptRef.current, r);
        }}
        onNext={() => {
          if (idx >= items.length - 1) {
            completeAttempt(attemptRef.current);
            advance();
          } else setIdx(idx + 1);
        }}
      />
    );
  }

  // ---------------------------------------------------------------- between the two parts
  if (session.stage === 'practice') {
    return (
      <div className="page">
        <ScreenHeader listenText="Part 1 is finished. Thank you. Now spend some time practising. When you are ready, press the button for the final check." />
        <h1>Part 1 is finished. Thank you!</h1>
        <p className="lead">Now spend some time practising. When you are ready, you will do a short final check.</p>
        <div className="btn-row">
          <Link href="/practice" className="btn">Start practising</Link>
          <button type="button" className="btn btn-secondary" onClick={advance}>I am ready for the final check</button>
        </div>
        <p className="muted">Your helper can press the second button when practice is finished.</p>
      </div>
    );
  }

  // ---------------------------------------------------------------- debrief
  const pre = session.pre_attempt_id ? getAttempt(session.pre_attempt_id) : undefined;
  const post = session.post_attempt_id ? getAttempt(session.post_attempt_id) : undefined;
  const parts = [pre, post].filter((a): a is AttemptRecord => Boolean(a));
  const preScore = pre ? scoreResponses(pre.responses) : null;
  const postScore = post ? scoreResponses(post.responses) : null;

  function downloadCsv() {
    const blob = new Blob([attemptsToCsv(parts)], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `is-it-ai-${session?.code ?? 'session'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="page">
      <ScreenHeader listenText="Thank you. All done. Here are your explanations." />
      <h1>Thank you. All done!</h1>
      <div className="stat-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="stat"><div className="num">{preScore ? `${preScore.points}/${preScore.max}` : '-'}</div><div className="lbl">Before practice</div></div>
        <div className="stat"><div className="num">{postScore ? `${postScore.points}/${postScore.max}` : '-'}</div><div className="lbl">After practice</div></div>
      </div>
      <p className="muted">Each example is worth 2 points: 1 for real or scam and 1 for the safe step.</p>

      <h2>The explanations</h2>
      {parts.map((a) => (
        <div key={a.attempt_id}>
          <h3>{a.mode === 'pre' ? 'Part 1 (before)' : 'Final check (after)'}</h3>
          {a.responses.map((r) => {
            const sc = getScenario(r.scenario_id);
            if (!sc) return null;
            const ok = r.verdict_correct && r.step_correct;
            return (
              <details className="tactic" key={r.scenario_id}>
                <summary>
                  <span>
                    <strong>{getTactic(sc.tactic)?.name ?? sc.sender_label}</strong>
                    <br />
                    <span className="muted">{sc.sender_label}</span>
                  </span>
                  <span className={`chip ${ok ? 'soft' : 'try'}`}>{ok ? '✔ Right' : '✖ Review'}</span>
                </summary>
                <div className="body">
                  <p>{sc.explanation}</p>
                  <p className="muted">
                    Real or scam: {r.verdict_correct ? 'right' : 'not quite'}. Safe step: {r.step_correct ? 'right' : 'not quite'}.
                  </p>
                </div>
              </details>
            );
          })}
        </div>
      ))}

      <div className="btn-row">
        <Link href="/learn" className="btn btn-secondary">Learn the words</Link>
        <button type="button" className="btn btn-quiet" onClick={downloadCsv}>For the researcher: download answers (CSV)</button>
        <button type="button" className="btn btn-quiet" onClick={endSession}>End this test session</button>
      </div>
    </div>
  );
}
