import { createHmac, createHash, timingSafeEqual } from 'node:crypto';

/** Server-side only. A tiny signed-cookie session for the /admin page. */

export const COOKIE_NAME = 'isitai_admin';
const MAX_AGE_S = 8 * 60 * 60;

export const adminConfigured = (): boolean => Boolean(process.env.ADMIN_PASSCODE);
const secret = () => process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSCODE || '';

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function passcodeMatches(input: string): boolean {
  const expected = process.env.ADMIN_PASSCODE ?? '';
  return expected.length > 0 && safeEqual(input, expected);
}

export function createSessionCookie(): string {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_S;
  const payload = String(exp);
  const token = `${payload}.${sign(payload)}`;
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${MAX_AGE_S}${secure}`;
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;
}

export function isAuthenticated(req: Request): boolean {
  if (!adminConfigured()) return false;
  const header = req.headers.get('cookie') ?? '';
  const match = header.split(';').map((s) => s.trim()).find((s) => s.startsWith(`${COOKIE_NAME}=`));
  if (!match) return false;
  const token = match.slice(COOKIE_NAME.length + 1);
  const [exp, sig] = token.split('.');
  if (!exp || !sig) return false;
  if (!/^\d+$/.test(exp) || Number(exp) < Math.floor(Date.now() / 1000)) return false;
  return safeEqual(sig, sign(exp));
}
