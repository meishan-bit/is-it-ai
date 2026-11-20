'use client';

import { useEffect, useState } from 'react';
import Icon from './Icon';

/** Read-aloud using the browser's built-in voice. It starts only when tapped, which iPhones require. */
export default function ListenButton({ text }: { text: string }) {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    setSupported(typeof window !== 'undefined' && 'speechSynthesis' in window);
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    };
  }, []);

  // A new screen means new text: stop whatever was being read.
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
    }
  }, [text]);

  function toggle() {
    const synth = window.speechSynthesis;
    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-CA';
    u.rate = 0.9;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    setSpeaking(true);
    synth.speak(u);
  }

  // In-app browsers (a link opened from a text or email) and some others have no built-in voice. Say what to do
  // instead of showing a button that does nothing (fix #9).
  if (!supported) {
    return (
      <p className="listen-note" role="note">
        <Icon name="listen-off" /> <span>To hear this, open the app in Chrome or Safari.</span>
      </p>
    );
  }
  return (
    <button type="button" className="btn btn-secondary btn-inline" onClick={toggle} aria-pressed={speaking}>
      <Icon name={speaking ? 'listen-stop' : 'listen'} /> {speaking ? 'Stop reading' : 'Listen'}
    </button>
  );
}
