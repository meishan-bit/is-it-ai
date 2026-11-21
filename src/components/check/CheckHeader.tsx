'use client';

import Link from 'next/link';
import Icon from '../Icon';
import ListenButton from '../ListenButton';

/** Same header as every other screen: Stop on the left, Listen on the right. Stop can ask first (the call questions). */
export default function CheckHeader({ listenText, onStop }: { listenText: string; onStop?: () => void }) {
  return (
    <div className="topbar">
      {onStop ? (
        <button type="button" className="btn btn-quiet btn-inline" onClick={onStop} aria-label="Stop and leave Check It">
          <Icon name="close" /> Stop
        </button>
      ) : (
        <Link href="/" className="btn btn-quiet btn-inline" aria-label="Stop and go to the home screen">
          <Icon name="close" /> Stop
        </Link>
      )}
      <ListenButton text={listenText} />
    </div>
  );
}
