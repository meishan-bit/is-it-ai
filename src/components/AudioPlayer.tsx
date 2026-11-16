'use client';

import { useRef, useState } from 'react';
import Icon from './Icon';

export default function AudioPlayer({ src, onFail }: { src: string; onFail?: () => void }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const [seconds, setSeconds] = useState<number | null>(null);

  function fail() {
    setFailed(true);
    setPlaying(false);
    onFail?.();
  }

  async function toggle() {
    const a = ref.current;
    if (!a) return;
    if (playing) {
      a.pause();
      return;
    }
    try {
      await a.play();
    } catch {
      fail();
    }
  }

  return (
    <div className="audio-box">
      <audio
        ref={ref}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={fail}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d)) setSeconds(Math.round(d));
        }}
      />
      <button type="button" className="btn" onClick={toggle} disabled={failed}>
        <Icon name={playing ? 'pause' : 'play'} />
        <span>
          {playing ? 'Pause' : 'Play the recording'}
          {seconds ? <small style={{ display: 'block', fontWeight: 400 }}>{seconds} seconds</small> : null}
        </span>
      </button>
      {failed && (
        <p className="error-text" role="alert">
          The recording could not play. Please read what was said below.
        </p>
      )}
    </div>
  );
}
