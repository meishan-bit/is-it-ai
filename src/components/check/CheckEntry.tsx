'use client';

import './check.css';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import CheckIcon from './CheckIcon';
import { CHECK } from '@/lib/check/types-content';
import { warmUpPhotoEngine } from '@/lib/check/engine';
import { getSession } from '@/lib/storage';

/** Starts loading the photo reader in the background, unless the phone is saving data. Runs once; later calls do nothing. */
function scheduleWarmUp(): void {
  const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
  if (nav.connection?.saveData) return;
  const run = () => {
    void warmUpPhotoEngine().catch(() => undefined);
  };
  if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 4000 });
  else setTimeout(run, 1500);
}

/**
 * Where Check It is offered: last on Home under its own heading, and once on the practice Finished screen.
 * Shown only when there is no test session or the session is done, so it cannot muddy the before and after scores.
 */
export default function CheckEntry({ variant }: { variant: 'home' | 'finished' }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const s = getSession();
    const ok = !s || s.stage === 'done';
    setShow(ok);
    if (ok && variant === 'home') scheduleWarmUp();
  }, [variant]);
  if (!show) return null;

  if (variant === 'finished') {
    return (
      <div className="card ck-finished">
        <p>{CHECK.screens.finished_line}</p>
        <Link href="/check" className="btn btn-secondary">
          <CheckIcon name="search" /> {CHECK.screens.finished_button}
        </Link>
      </div>
    );
  }
  return (
    <section aria-labelledby="ck-home-h">
      <h2 id="ck-home-h" className="ck-heading">
        {CHECK.screens.home_heading}
      </h2>
      <Link href="/check" className="btn btn-secondary ck-entry">
        <CheckIcon name="search" />
        <span>
          {CHECK.screens.home_button}
          <small>{CHECK.screens.home_note}</small>
        </span>
      </Link>
    </section>
  );
}
