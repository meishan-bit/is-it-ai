'use client';

import CheckIcon from './CheckIcon';
import PhoneText from './PhoneText';
import { CHECK, fill } from '@/lib/check/types-content';
import type { CheckResult } from '@/lib/check/types';

/** Text for the banner heading and body line. Never says safe, real or OK: it counts warning signs. */
export function resultCopy(r: CheckResult): { heading: string; body: string } {
  const L = CHECK.levels;
  if (r.signal_level === 'strong') {
    return { heading: L.strong.heading, body: r.tactic_name ? fill(L.strong.body_known, { tactic: r.tactic_name }) : L.strong.body_unknown };
  }
  if (r.signal_level === 'some') return { heading: L.some.heading, body: L.some.body };
  return { heading: L.none_found.heading, body: L.none_found.body };
}

/** Listen reads: heading, body line, clues, then the safe step. */
export function resultSpeech(r: CheckResult): string {
  const c = resultCopy(r);
  return [c.heading, c.body, ...r.clues, r.safe_step].join('. ');
}

/** Levels differ by icon shape and words, not only colour: filled triangle, outlined triangle, info circle. */
export default function ResultView({ result, headingRef, onNext }: { result: CheckResult; headingRef: React.RefObject<HTMLHeadingElement | null>; onNext: () => void }) {
  const c = resultCopy(result);
  const warn = result.signal_level !== 'none_found';
  return (
    <>
      {warn ? (
        <div className="verdict-banner try" role="status">
          <CheckIcon name={result.signal_level === 'strong' ? 'triangle-filled' : 'triangle-outline'} />
          <h1 className="ck-level" ref={headingRef} tabIndex={-1}>{c.heading}</h1>
        </div>
      ) : (
        <div className="ck-none" role="status">
          <h1 className="ck-level" ref={headingRef} tabIndex={-1}><CheckIcon name="info" /> {c.heading}</h1>
        </div>
      )}
      <p className="ck-body">{c.body}</p>
      {result.clues.length > 0 && (
        <ul className="ck-clues">
          {result.clues.map((x) => <li key={x}>{x}</li>)}
        </ul>
      )}
      {result.note && <p className="notice" role="note">{result.note}</p>}
      <div className="btn-row">
        <button type="button" className="btn" onClick={onNext}>{CHECK.screens.result_button}</button>
      </div>
      <div className="ck-report">
        <h3>{CHECK.report.heading}</h3>
        <a className="btn btn-quiet" href={CHECK.sample_number.tel}><PhoneText text={CHECK.report.button} /></a>
        <p>{CHECK.report.note}</p>
      </div>
    </>
  );
}
