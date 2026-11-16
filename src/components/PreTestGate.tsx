'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getSession } from '@/lib/storage';
import ScreenHeader from './ScreenHeader';

/** While a tester is still on the "before" check, practice and learning screens are closed so the pre-test stays fair. */
export default function PreTestGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<'checking' | 'locked' | 'open'>('checking');
  useEffect(() => {
    setState(getSession()?.stage === 'pre' ? 'locked' : 'open');
  }, []);
  if (state === 'checking') return null;
  if (state === 'open') return <>{children}</>;
  return (
    <div className="page">
      <ScreenHeader listenText="Please finish Part 1 first. Then you can practise and learn." />
      <h1>Please finish Part 1 first</h1>
      <p className="lead">Practice and learning open after the first five examples.</p>
      <div className="btn-row">
        <Link href="/test" className="btn">Continue Part 1</Link>
      </div>
    </div>
  );
}
