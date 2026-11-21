'use client';

import './check.css';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import ScreenHeader from '../ScreenHeader';
import TalkToPerson from './TalkToPerson';
import { CHECK } from '@/lib/check/types-content';
import { getSession } from '@/lib/storage';

/** During a test session Check It is closed. The same pattern as PreTestGate: a short locked screen with a way out. */
export default function CheckGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<'checking' | 'locked' | 'open'>('checking');
  useEffect(() => {
    const s = getSession();
    setState(!s || s.stage === 'done' ? 'open' : 'locked');
  }, []);
  if (state === 'checking') return null;
  if (state === 'open') return <>{children}</>;
  return (
    <div className="page">
      <ScreenHeader listenText={CHECK.screens.locked_body} />
      <h1>{CHECK.screens.locked_heading}</h1>
      <p className="lead">You can still talk to a person.</p>
      <div className="btn-row">
        <Link href="/" className="btn">
          {CHECK.screens.home_back_button}
        </Link>
      </div>
      <TalkToPerson />
    </div>
  );
}
