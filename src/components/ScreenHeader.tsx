'use client';

import Link from 'next/link';
import Icon from './Icon';
import ListenButton from './ListenButton';

/** The only two things at the top of every screen: a way home (or to stop) and a Listen button. */
export default function ScreenHeader({ stop = false, listenText }: { stop?: boolean; listenText: string }) {
  return (
    <div className="topbar">
      <Link
        href="/"
        className="btn btn-quiet btn-inline"
        aria-label={stop ? 'Stop and go to the home screen' : 'Go to the home screen'}
      >
        <Icon name={stop ? 'close' : 'back'} /> {stop ? 'Stop' : 'Home'}
      </Link>
      <ListenButton text={listenText} />
    </div>
  );
}
