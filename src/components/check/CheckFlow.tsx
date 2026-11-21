'use client';

import './check.css';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import CheckHeader from './CheckHeader';
import CheckIcon from './CheckIcon';
import PhoneText from './PhoneText';
import ResultView, { resultSpeech } from './ResultView';
import ReviewChips from './ReviewChips';
import TalkToPerson from './TalkToPerson';
import { chipStats, chipsFromText, chipsFromWords, hiddenBoxes, maskedText, toggleChip, wordsToText, type Chip } from '@/lib/check/chips';
import { findCanadianPii } from '@/lib/check/ca-patterns';
import { postCheck } from '@/lib/check/client';
import { getPhotoEngine, subscribeProgress, warmUpPhotoEngine, type EngineProgress } from '@/lib/check/engine';
import { dropStatusBar, findNames } from '@/lib/check/names';
import { MAX_TEXT_CHARS } from '@/lib/check/request';
import { MAX_FILE_BYTES, clearCanvas, drawRedacted, fileToCanvas, redactedPngBase64 } from '@/lib/check/render';
import { CALL_KEYS, type CallAnswer, type CallKey, type CheckResult, type Span } from '@/lib/check/types';
import { CHECK, fill } from '@/lib/check/types-content';
import { getAnonId } from '@/lib/storage';
import { CONTENT_VERSION } from '@/lib/version';

type Screen = 'choose' | 'photo' | 'paste' | 'call' | 'ready' | 'hiding' | 'review' | 'checking' | 'result' | 'todo' | 'error';
type Mode = 'photo' | 'paste' | 'call';
type ErrorKind = 'unreadable' | 'offline' | 'too_many' | 'wrong';

const S = CHECK.screens;
const SLOW_MS = 60_000;

export default function CheckFlow() {
  const [screen, setScreen] = useState<Screen>('choose');
  const [mode, setMode] = useState<Mode>('photo');
  const [callIdx, setCallIdx] = useState(0);
  const [findingNames, setFindingNames] = useState(false);
  const [answers, setAnswers] = useState<Partial<Record<CallKey, CallAnswer>>>({});
  const [leaveAsk, setLeaveAsk] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [showFallback, setShowFallback] = useState(false);
  const [tooLong, setTooLong] = useState(false);
  const [chips, setChips] = useState<Chip[]>([]);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [errorKind, setErrorKind] = useState<ErrorKind>('wrong');
  const [progress, setProgress] = useState<EngineProgress>({ stage: 'Getting the reader ready', percent: null });
  const [slow, setSlow] = useState(false);

  const alive = useRef(true);
  const heading = useRef<HTMLHeadingElement>(null);
  const srcCanvas = useRef<HTMLCanvasElement | null>(null);
  const preview = useRef<HTMLCanvasElement | null>(null);
  const lastPayload = useRef<unknown>(null);
  const pendingFile = useRef<File | null>(null);
  const pickInput = useRef<HTMLInputElement>(null);
  const takeInput = useRef<HTMLInputElement>(null);

  /** Clears the original picture, the words read from it and the pasted text from memory. */
  const clearSensitive = useCallback(() => {
    clearCanvas(srcCanvas.current);
    srcCanvas.current = null;
    clearCanvas(preview.current);
    pendingFile.current = null;
    lastPayload.current = null;
    setChips([]);
    setPasteText('');
    setConfirmId(null);
  }, []);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      clearCanvas(srcCanvas.current);
      srcCanvas.current = null;
      pendingFile.current = null;
      lastPayload.current = null;
    };
  }, []);

  useEffect(() => {
    heading.current?.focus();
    window.scrollTo({ top: 0 });
  }, [screen, callIdx]);

  // "Getting ready": follow the reader's progress, and after 60 seconds offer another way.
  useEffect(() => {
    if (screen !== 'ready') return;
    setSlow(false);
    const off = subscribeProgress(setProgress);
    const t = setTimeout(() => setSlow(true), SLOW_MS);
    return () => {
      off();
      clearTimeout(t);
    };
  }, [screen]);

  // The picture on the review screen is redrawn on every tap, so black boxes appear and go at once.
  useEffect(() => {
    if (screen === 'review' && mode === 'photo' && srcCanvas.current && preview.current) {
      drawRedacted(preview.current, srcCanvas.current, hiddenBoxes(chips));
    }
  }, [chips, screen, mode]);

  const fail = (kind: ErrorKind) => {
    setErrorKind(kind);
    setScreen('error');
  };

  // ------------------------------------------------------------------ photo
  async function readPicture(file: File) {
    setScreen('hiding');
    try {
      const engine = getPhotoEngine();
      const canvas = await fileToCanvas(file);
      if (!alive.current) return clearCanvas(canvas);
      srcCanvas.current = canvas;
      const words = await engine.recognize(canvas);
      if (!alive.current) return;
      if (words.filter((w) => /[A-Za-z0-9]/.test(w.text)).length < 2) return fail('unreadable');
      const { text } = wordsToText(words);
      let extra: Span[] = [];
      if (engine.detectNames) {
        try {
          extra = dropStatusBar(await engine.detectNames(text), words, canvas.width, canvas.height);
        } catch {
          extra = [];
        }
      }
      setChips(chipsFromWords(words, findCanadianPii(text, extra)));
      pendingFile.current = null;
      setScreen('review');
    } catch {
      if (alive.current) fail('unreadable');
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > MAX_FILE_BYTES) return fail('unreadable');
    pendingFile.current = file;
    setMode('photo');
    if (!getPhotoEngine().isReady()) {
      setScreen('ready');
      try {
        await warmUpPhotoEngine();
      } catch {
        if (alive.current) fail('unreadable');
        return;
      }
      if (!alive.current) return;
    }
    await readPicture(file);
  }

  // ------------------------------------------------------------------ paste
  async function doPaste() {
    try {
      const t = await navigator.clipboard.readText();
      if (!t.trim()) return setShowFallback(true);
      setPasteText(t);
      setTooLong(false);
    } catch {
      setShowFallback(true);
    }
  }

  async function pasteNext() {
    if (pasteText.length > MAX_TEXT_CHARS) return setTooLong(true);
    if (findingNames) return;
    setFindingNames(true);
    const names = await findNames(pasteText); // never throws; [] if the name finder cannot load
    setFindingNames(false);
    if (!alive.current) return;
    setMode('paste');
    setChips(chipsFromText(pasteText, findCanadianPii(pasteText, names)));
    setScreen('review');
  }

  // ------------------------------------------------------------------ review + send
  function onChipTap(c: Chip) {
    // Showing a detail we hid on our own asks first. Words the person hid themselves toggle freely.
    if (c.hidden && c.auto) return setConfirmId(c.id);
    setChips((prev) => toggleChip(prev, c.id));
  }

  async function submit(payload: unknown) {
    setScreen('checking');
    lastPayload.current = payload;
    const out = await postCheck(payload);
    if (!alive.current) return;
    if (out.ok) {
      setResult(out.result);
      clearSensitive();
      setScreen('result');
    } else fail(out.kind);
  }

  async function send() {
    const stats = chipStats(chips);
    const base = { anon_id: getAnonId(), content_version: CONTENT_VERSION, ...stats };
    setScreen('checking');
    try {
      if (mode === 'photo' && srcCanvas.current) {
        const image = await redactedPngBase64(srcCanvas.current, hiddenBoxes(chips));
        return submit({ input_type: 'photo', image, ...base });
      }
      return submit({ input_type: 'paste', text: maskedText(pasteText, chips), ...base });
    } catch {
      if (alive.current) fail('wrong');
    }
  }

  // ------------------------------------------------------------------ call
  function answer(a: CallAnswer) {
    const key = CALL_KEYS[callIdx];
    const next = { ...answers, [key]: a };
    setAnswers(next);
    if (callIdx < CALL_KEYS.length - 1) return setCallIdx(callIdx + 1);
    void submit({
      input_type: 'call',
      call_answers: next,
      anon_id: getAnonId(),
      content_version: CONTENT_VERSION,
      redaction_counts: {},
      user_unhid_count: 0,
      user_added_count: 0,
    });
  }

  function startCall() {
    setMode('call');
    setCallIdx(0);
    setAnswers({});
    setLeaveAsk(false);
    setScreen('call');
  }

  function startOver() {
    clearSensitive();
    setResult(null);
    setAnswers({});
    setCallIdx(0);
    setScreen('choose');
  }

  function retry() {
    if (lastPayload.current) void submit(lastPayload.current);
    else startOver();
  }

  // ------------------------------------------------------------------ screens
  const E = CHECK.errors;
  const q = CHECK.call_questions[callIdx];
  let listen = '';
  let body: React.ReactNode = null;

  if (screen === 'choose') {
    listen = `${S.choose_heading} ${S.photo_button}. ${S.photo_note}. ${S.paste_button}. ${S.paste_note}. ${S.call_button}. ${S.call_note}. ${S.choose_privacy}`;
    body = (
      <>
        <h1 ref={heading} tabIndex={-1}>{S.choose_heading}</h1>
        <div className="ck-choose">
          <button type="button" className="btn btn-secondary" onClick={() => setScreen('photo')}>
            <CheckIcon name="camera" /><span>{S.photo_button}<small>{S.photo_note}</small></span>
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => { setMode('paste'); setScreen('paste'); }}>
            <CheckIcon name="clipboard" /><span>{S.paste_button}<small>{S.paste_note}</small></span>
          </button>
          <button type="button" className="btn btn-secondary" onClick={startCall}>
            <CheckIcon name="phone" /><span>{S.call_button}<small>{S.call_note}</small></span>
          </button>
        </div>
        <p className="notice"><CheckIcon name="lock" /> {S.choose_privacy}</p>
      </>
    );
  } else if (screen === 'photo') {
    listen = `${S.photo_heading}. ${S.photo_help}`;
    body = (
      <>
        <h1 ref={heading} tabIndex={-1}>{S.photo_heading}</h1>
        <p className="lead">{S.photo_help}</p>
        <div className="btn-row">
          <button type="button" className="btn" onClick={() => pickInput.current?.click()}><CheckIcon name="camera" /> {S.photo_choose}</button>
          <button type="button" className="btn btn-secondary" onClick={() => takeInput.current?.click()}><CheckIcon name="camera" /> {S.photo_take}</button>
          <button type="button" className="btn btn-quiet" onClick={() => setScreen('choose')}>{S.back}</button>
        </div>
        <input ref={pickInput} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" tabIndex={-1} aria-hidden="true" data-testid="pick"
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; void onFile(f); }} />
        <input ref={takeInput} type="file" accept="image/png,image/jpeg,image/webp" capture="environment" className="sr-only" tabIndex={-1} aria-hidden="true" data-testid="take"
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; void onFile(f); }} />
      </>
    );
  } else if (screen === 'paste') {
    listen = `${S.paste_heading}. ${S.paste_help}`;
    body = (
      <>
        <h1 ref={heading} tabIndex={-1}>{S.paste_heading}</h1>
        <p className="lead">{S.paste_help}</p>
        <div className="btn-row">
          <button type="button" className="btn" onClick={doPaste}><CheckIcon name="clipboard" /> {S.paste_button_label}</button>
        </div>
        {pasteText && !showFallback && <div className="ck-masked" aria-label="The message you pasted" data-testid="pasted">{pasteText}</div>}
        {showFallback && (
          <div className="field">
            <label htmlFor="ck-ta">{S.paste_fallback}</label>
            <textarea id="ck-ta" className="ck-textarea" value={pasteText} onChange={(e) => { setPasteText(e.target.value); setTooLong(false); }} />
          </div>
        )}
        {tooLong && <p className="error-text" role="alert">{S.paste_too_long}</p>}
        <div className="btn-row">
          <button type="button" className="btn" disabled={!pasteText.trim() || findingNames} onClick={pasteNext}>{S.paste_next}</button>
          <button type="button" className="btn btn-quiet" onClick={() => setScreen('choose')}>{S.back}</button>
        </div>
      </>
    );
  } else if (screen === 'call') {
    const n = callIdx + 1;
    const progressText = fill(S.call_progress, { n, total: CALL_KEYS.length });
    listen = `${progressText}. ${q.text} Choices: ${S.answer_yes}, ${S.answer_no}, ${S.answer_not_sure}.`;
    body = (
      <>
        <p className="stepcount">{progressText}</p>
        <div className="dots" aria-hidden="true">
          {CALL_KEYS.map((k, i) => <span key={k} className={i < callIdx ? 'done' : i === callIdx ? 'now' : ''} />)}
        </div>
        <h1 ref={heading} tabIndex={-1}>{q.text}</h1>
        <div role="group" aria-label={q.text}>
          <button type="button" className="btn-choice" onClick={() => answer('yes')}>{S.answer_yes}</button>
          <button type="button" className="btn-choice" onClick={() => answer('no')}>{S.answer_no}</button>
          <button type="button" className="btn-choice" onClick={() => answer('not_sure')}>{S.answer_not_sure}</button>
        </div>
        {callIdx > 0 && <button type="button" className="btn btn-quiet" onClick={() => setCallIdx(callIdx - 1)}>{S.back}</button>}
      </>
    );
  } else if (screen === 'ready') {
    listen = `${S.ready_heading}. ${S.ready_body}${slow ? ` ${S.ready_slow}` : ''}`;
    body = (
      <>
        <h1 ref={heading} tabIndex={-1}>{S.ready_heading}</h1>
        <p className="lead">{S.ready_body}</p>
        <progress className="ck-progress" max={100} value={progress.percent ?? undefined} aria-label={progress.stage} />
        <p className="muted" role="status">{progress.stage}</p>
        {slow && (
          <>
            <p className="notice" role="status">{S.ready_slow}</p>
            <div className="btn-row"><button type="button" className="btn btn-secondary" onClick={startCall}>{E.unreadable.secondary}</button></div>
          </>
        )}
      </>
    );
  } else if (screen === 'hiding' || screen === 'checking') {
    const text = screen === 'hiding' ? S.hiding_heading : S.checking_heading;
    listen = text;
    body = (
      <>
        <h1 ref={heading} tabIndex={-1}>{text}</h1>
        <progress className="ck-progress" max={100} aria-label={text} />
      </>
    );
  } else if (screen === 'review') {
    const isPhoto = mode === 'photo';
    const hiddenCount = chips.filter((c) => c.hidden).length;
    listen = `${S.review_heading}. ${isPhoto ? S.review_help : S.review_help_text} ${fill(S.review_count, { n: hiddenCount })}.`;
    const confirming = chips.find((c) => c.id === confirmId);
    body = (
      <>
        <h1 ref={heading} tabIndex={-1}>{S.review_heading}</h1>
        <p className="lead">{isPhoto ? S.review_help : S.review_help_text}</p>
        {isPhoto ? (
          <div className="ck-preview"><canvas ref={preview} role="img" aria-label="Your picture with personal details hidden" data-testid="preview" /></div>
        ) : (
          <div className="ck-masked" aria-label="The message that will be sent" data-testid="masked">{maskedText(pasteText, chips)}</div>
        )}
        {confirming && (
          <div className="ck-confirm" role="alertdialog" aria-label={S.confirm_show}>
            <p>{S.confirm_show}</p>
            <div className="btn-row two">
              <button type="button" className="btn" onClick={() => { setChips((p) => toggleChip(p, confirming.id)); setConfirmId(null); }}>{S.confirm_show_yes}</button>
              <button type="button" className="btn btn-secondary" onClick={() => setConfirmId(null)}>{S.confirm_show_no}</button>
            </div>
          </div>
        )}
        <ReviewChips chips={chips} onTap={onChipTap} />
        <p className="muted">{S.send_note}</p>
        <div className="btn-row"><button type="button" className="btn" onClick={() => void send()}>{S.send_button}</button></div>
      </>
    );
  } else if (screen === 'result' && result) {
    listen = resultSpeech(result);
    body = <ResultView result={result} headingRef={heading} onNext={() => setScreen('todo')} />;
  } else if (screen === 'todo' && result) {
    listen = `${S.todo_heading}. ${result.safe_step}. ${CHECK.report.heading}. ${CHECK.report.note}`;
    body = (
      <>
        <h1 ref={heading} tabIndex={-1}>{S.todo_heading}</h1>
        <div className="todo"><h3>{S.todo_heading}</h3><p>{result.safe_step}</p></div>
        <div className="ck-report">
          <h3>{CHECK.report.heading}</h3>
          <a className="btn btn-secondary" href={CHECK.sample_number.tel}><PhoneText text={CHECK.report.button} /></a>
          <p>{CHECK.report.note}</p>
        </div>
        <p><Link href={result.learn_href}>{result.tactic_name ? `Learn more about ${result.tactic_name}` : 'Learn the words'}</Link></p>
        <div className="btn-row">
          <button type="button" className="btn" onClick={startOver}>{S.again_button}</button>
          <Link href="/" className="btn btn-secondary">{S.home_back_button}</Link>
        </div>
      </>
    );
  } else if (screen === 'error') {
    const e = E[errorKind];
    listen = `${e.heading}. ${e.body}`;
    const secondary = 'secondary' in e ? (e as { secondary: string }).secondary : null;
    body = (
      <>
        <h1 ref={heading} tabIndex={-1}>{e.heading}</h1>
        <p className="lead">{e.body}</p>
        <div className="btn-row">
          {errorKind === 'unreadable' && (
            <>
              <button type="button" className="btn" onClick={() => setScreen('photo')}>{e.primary}</button>
              <button type="button" className="btn btn-secondary" onClick={startCall}>{secondary}</button>
            </>
          )}
          {(errorKind === 'offline' || errorKind === 'wrong') && <button type="button" className="btn" onClick={retry}>{e.primary}</button>}
          {errorKind === 'too_many' && <a className="btn" href={CHECK.sample_number.tel}>{e.primary}</a>}
          {(errorKind === 'wrong' || errorKind === 'too_many') && <Link href="/" className="btn btn-secondary">{secondary}</Link>}
        </div>
      </>
    );
  }

  const stopAsks = screen === 'call' && callIdx >= 0 && Object.keys(answers).length > 0;
  return (
    <div className="page">
      <CheckHeader listenText={listen} onStop={stopAsks ? () => setLeaveAsk(true) : undefined} />
      {leaveAsk && (
        <div className="ck-confirm" role="alertdialog" aria-label={S.call_stop_confirm}>
          <p>{S.call_stop_confirm}</p>
          <div className="btn-row two">
            <Link href="/" className="btn">{S.call_stop_leave}</Link>
            <button type="button" className="btn btn-secondary" onClick={() => setLeaveAsk(false)}>{S.call_stop_stay}</button>
          </div>
        </div>
      )}
      {body}
      <TalkToPerson />
    </div>
  );
}
