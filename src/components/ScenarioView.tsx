'use client';

import { useState } from 'react';
import type { Scenario } from '@/lib/types';
import AudioPlayer from './AudioPlayer';

function Highlighted({ text, phrases }: { text: string; phrases: string[] }) {
  if (phrases.length === 0) return <>{text}</>;
  const escaped = phrases
    .slice()
    .sort((a, b) => b.length - a.length)
    .map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const parts = text.split(new RegExp('(' + escaped.join('|') + ')', 'g'));
  return (
    <>
      {parts.map((p, i) => (phrases.includes(p) ? <mark key={i}>{p}</mark> : <span key={i}>{p}</span>))}
    </>
  );
}

/** Shows one training example. Every example carries a "Training example" label, and AI-made ones say so. */
export default function ScenarioView({
  scenario,
  highlight = false,
  transcriptOpen = false,
  hideRecording = false,
}: {
  scenario: Scenario;
  highlight?: boolean;
  transcriptOpen?: boolean;
  /** Feedback screens show the transcript only: the recording was already played on the question screens (fix #4). */
  hideRecording?: boolean;
}) {
  const [audioFailed, setAudioFailed] = useState(false);
  const phrases = highlight ? scenario.highlights : [];
  const isImage = scenario.media_kind === 'image';

  return (
    <section className="example" aria-label="The example">
      <div>
        <span className="tag">Training example</span>
        {scenario.ai_generated && <span className="tag tag-ai">Made with AI for training</span>}
      </div>

      {scenario.format === 'text_image' && isImage && scenario.media_url ? (
        <div className="profile">
          <img src={scenario.media_url} alt={scenario.alt_text ?? ''} />
          <p className="sender" style={{ margin: 0 }}>{scenario.sender_label}</p>
        </div>
      ) : (
        <p className="sender">{scenario.sender_label}</p>
      )}

      {scenario.message.map((m, i) => (
        <p className="bubble" key={i}>
          <Highlighted text={m} phrases={phrases} />
        </p>
      ))}

      {scenario.format === 'image' && isImage && scenario.media_url && (
        <figure className={`media${scenario.media_orientation === 'portrait' ? ' tall' : ''}`}>
          <img src={scenario.media_url} alt={scenario.alt_text ?? ''} />
          {scenario.caption && <figcaption className="caption-bar">{scenario.caption}</figcaption>}
        </figure>
      )}

      {scenario.format === 'audio' && scenario.media_url && (
        <>
          {!hideRecording && <AudioPlayer src={scenario.media_url} onFail={() => setAudioFailed(true)} />}
          {scenario.transcript && (
            <details className="transcript" open={audioFailed || transcriptOpen}>
              <summary>Read what was said</summary>
              <p>
                <Highlighted text={scenario.transcript} phrases={phrases} />
              </p>
            </details>
          )}
        </>
      )}
    </section>
  );
}

/** Plain text of an example for the Listen button. Audio examples are not read out, so the recording stays the star. */
export function scenarioSpeech(s: Scenario): string {
  if (s.format === 'audio') return `${s.sender_label}. This is a recording. Tap Play the recording to hear it.`;
  if (s.format === 'image') return `${s.sender_label}. ${s.alt_text ?? ''} ${s.caption ?? ''}`;
  return `${s.sender_label}. ${s.message.join(' ')}`;
}
