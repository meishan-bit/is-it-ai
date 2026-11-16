'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import ItemRunner from './ItemRunner';
import ScreenHeader from './ScreenHeader';
import { PRACTICE_POOL, getTactic } from '@/lib/content';
import { shuffle } from '@/lib/rng';
import { isExampleRight } from '@/lib/scoring';
import { pickPracticeRound } from '@/lib/selection';
import { getSeen, getSession, setSeen, setSession } from '@/lib/storage';
import { completeAttempt, flushOutbox, recordResponse, startAttempt } from '@/lib/tracker';
import type { ResponseRecord, Scenario, TestSession } from '@/lib/types';

export default function PracticeFlow() {
  const [items, setItems] = useState<Scenario[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [results, setResults] = useState<ResponseRecord[]>([]);
  const [themed, setThemed] = useState(false);
  const [session, setSessionState] = useState<TestSession | null>(null);
  const attemptId = useRef('');
  const didInit = useRef(false);

  const begin = useCallback((only: string[] | null) => {
    const s = getSession();
    setSessionState(s);
    let picked: Scenario[];
    if (only && only.length > 0) {
      picked = shuffle(PRACTICE_POOL.filter((x) => only.includes(x.id))).slice(0, 5);
    } else {
      const r = pickPracticeRound(PRACTICE_POOL, getSeen());
      setSeen(r.seen);
      picked = r.items;
    }
    if (picked.length === 0) picked = pickPracticeRound(PRACTICE_POOL, []).items;
    const attempt = startAttempt({ mode: 'practice', form: null, anonId: s?.code, isTestCode: Boolean(s) });
    attemptId.current = attempt.attempt_id;
    setThemed(Boolean(only && only.length > 0));
    setItems(picked);
    setIdx(0);
    setResults([]);
  }, []);

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    void flushOutbox();
    const q = new URLSearchParams(window.location.search).get('only');
    begin(q ? q.split(',').map((x) => x.trim().toUpperCase()).filter(Boolean) : null);
  }, [begin]);

  if (!items) return null;

  // ---------------------------------------------------------------- results
  if (idx >= items.length) {
    const right = results.filter(isExampleRight).length;
    const note =
      right === items.length
        ? 'Excellent. You spotted every one.'
        : right >= Math.ceil(items.length / 2)
          ? 'Good work. Each round makes the signs easier to see.'
          : 'This is how everyone learns. Scams fool a lot of people, and practice helps.';
    const inTest = session?.stage === 'practice';
    return (
      <div className="page">
        <ScreenHeader listenText={`Round finished. You got ${right} of ${items.length} right. ${note}`} />
        <h1>Round finished</h1>
        <div className="stat" style={{ marginBottom: 18 }}>
          <div className="num">{right} of {items.length}</div>
          <div className="lbl">examples where you chose both the right answer and the safe step</div>
        </div>
        <p className="lead">{note}</p>
        <ul className="checks card" style={{ padding: 18 }}>
          {items.map((s, i) => {
            const ok = results[i] ? isExampleRight(results[i]) : false;
            return (
              <li key={s.id}>
                <span className={`mark-icon ${ok ? 'ok' : 'no'}`} aria-hidden="true">{ok ? '✔' : '✖'}</span>
                <span>
                  <span className="sr-only">{ok ? 'Right. ' : 'Not quite. '}</span>
                  {getTactic(s.tactic)?.name ?? s.sender_label}
                </span>
              </li>
            );
          })}
        </ul>
        <div className="btn-row">
          {inTest && (
            <button
              type="button"
              className="btn"
              onClick={() => {
                const s = getSession();
                if (s) setSession({ ...s, stage: 'post' });
                window.location.href = '/test';
              }}
            >
              I am ready for the final check
            </button>
          )}
          <button type="button" className={inTest ? 'btn btn-secondary' : 'btn'} onClick={() => begin(null)}>
            {themed ? 'Practise a mixed round' : 'Practise 5 more'}
          </button>
          <Link href="/progress" className="btn btn-secondary">See my progress</Link>
        </div>
      </div>
    );
  }

  const scenario = items[idx];
  return (
    <ItemRunner
      key={scenario.id + ':' + attemptId.current}
      scenario={scenario}
      index={idx}
      total={items.length}
      mode="practice"
      isLast={idx === items.length - 1}
      onAnswered={(r) => {
        recordResponse(attemptId.current, r);
        setResults((prev) => [...prev, r]);
        if (idx === items.length - 1) completeAttempt(attemptId.current);
      }}
      onNext={() => setIdx((i) => i + 1)}
    />
  );
}
