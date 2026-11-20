'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Icon from './Icon';
import ListenButton from './ListenButton';
import ThemeSwitch from './ThemeSwitch';
import { getSession } from '@/lib/storage';
import { flushOutbox } from '@/lib/tracker';
import type { TestSession } from '@/lib/types';

export default function HomeScreen() {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<TestSession | null>(null);

  useEffect(() => {
    setSession(getSession());
    setReady(true);
    void flushOutbox();
  }, []);

  const pre = session?.stage === 'pre';
  const intro =
    'Is It AI? Practise spotting scams made with AI. It is safe here. There are no timers and no penalties. Choose what you would like to do.';

  return (
    <div className="page">
      <div className="topbar">
        <span />
        <ListenButton text={intro} />
      </div>
      <div className="hero">
        <h1>Is It AI?</h1>
        <p className="lead">
          Practise spotting scams made with AI. It is safe here: no timers, no penalties, and nobody sees your name.
        </p>
      </div>

      {ready && (
        <nav className="menu" aria-label="Main choices">
          {pre ? (
            <Link href="/test" className="btn">
              Continue Part 1 (session {session?.code})
            </Link>
          ) : (
            <>
              <Link href="/practice" className="btn">
                <Icon name="check" />
                <span>
                  Practise
                  <small>5 short examples, with help after each one</small>
                </span>
              </Link>
              <Link href="/learn" className="btn btn-secondary">
                <Icon name="book" />
                <span>
                  Learn the words
                  <small>What a deepfake or a voice clone is</small>
                </span>
              </Link>
              <Link href="/progress" className="btn btn-secondary">
                <Icon name="chart" />
                <span>
                  My progress
                  <small>What you have practised and what to watch for</small>
                </span>
              </Link>
              {session && session.stage !== 'done' && (
                <Link href="/test" className="btn btn-quiet">
                  Continue test session {session.code}
                </Link>
              )}
            </>
          )}
        </nav>
      )}

      {ready && !session && (
        <p className="muted">
          Taking part in a research session? <Link href="/test">Start your test here</Link>.
        </p>
      )}

      <ThemeSwitch />
    </div>
  );
}
