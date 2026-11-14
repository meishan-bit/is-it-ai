import type { AttemptRecord, TestSession } from './types';

/** Browser-only helpers. Everything stays on this device unless the server saves it (see tracker.ts). */

const P = 'isitai.v1.';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(P + key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(P + key, JSON.stringify(value));
  } catch {
    /* private mode or full: the app still works, progress just is not kept */
  }
}
function remove(key: string): void {
  try {
    window.localStorage.removeItem(P + key);
  } catch {
    /* ignore */
  }
}

export function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function getAnonId(): string {
  const existing = read<string | null>('anon', null);
  if (existing) return existing;
  const fresh = `u-${uuid()}`;
  write('anon', fresh);
  return fresh;
}

export function getSession(): TestSession | null {
  return read<TestSession | null>('session', null);
}
export function setSession(s: TestSession | null): void {
  if (s === null) remove('session');
  else write('session', s);
}

export function getAttempts(): AttemptRecord[] {
  return read<AttemptRecord[]>('attempts', []);
}
export function getAttempt(id: string): AttemptRecord | undefined {
  return getAttempts().find((a) => a.attempt_id === id);
}
export function saveAttempt(a: AttemptRecord): void {
  const all = getAttempts().filter((x) => x.attempt_id !== a.attempt_id);
  all.push(a);
  write('attempts', all.slice(-300));
}

export function getSeen(): string[] {
  return read<string[]>('seen', []);
}
export function setSeen(ids: string[]): void {
  write('seen', ids);
}

/** Clears practice history on this device. Test sessions and the anonymous id are left alone. */
export function clearProgress(): void {
  const keep = getAttempts().filter((a) => a.mode !== 'practice');
  write('attempts', keep);
  remove('seen');
}

export function loadOutbox(): unknown[] {
  return read<unknown[]>('outbox', []);
}
export function saveOutbox(q: unknown[]): void {
  write('outbox', q.slice(-1000));
}

export function detectDevice(): 'phone' | 'tablet' | 'desktop' {
  const w = Math.min(window.screen?.width || window.innerWidth, window.innerWidth || 9999);
  if (w < 600) return 'phone';
  if (w < 1024) return 'tablet';
  return 'desktop';
}
