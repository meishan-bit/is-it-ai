import type { Span } from './types';

/**
 * Canadian personal-detail rules for Check It. Runs on the phone, before anything is sent.
 *
 * Nine rules: ID number (SIN and other 9-digit IDs, including the Saskatchewan health card), postal code,
 * provincial health numbers, phone numbers, card number with expiry and security code, codes and PINs,
 * the name part of an email address, tracking codes in links, and birth dates.
 * Two extra helpers find likely names and street addresses (labels: name, address).
 *
 * What stays visible on purpose, because these are the scam clues: dollar amounts, deadlines and times,
 * link domains and email domains.
 *
 * No look-behind in any pattern: older iPhones (before iOS 16.4) cannot even load a file that contains one.
 * Written for this project from the rule list in the Check It Build Brief. The team's tested rules in PR #1 (ca-patterns.ts, adapted
 * from Presidio, canpii and wuming) can replace this file: keep the findCanadianPii(text, extra) signature. See docs/CHECK_IT.md.
 */

const MONTH = '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)';
const NAME = "[A-Z][a-z]+(?:[-'\u2019][A-Z][a-z]+)?";

const isDigit = (c: string | undefined): boolean => c !== undefined && c >= '0' && c <= '9';
const isAlnum = (c: string | undefined): boolean => c !== undefined && /[A-Za-z0-9]/.test(c);

function each(re: RegExp, text: string, fn: (m: RegExpExecArray) => void): void {
  const flags = re.flags.includes('g') ? re.flags : re.flags + 'g';
  const r = new RegExp(re.source, flags);
  let m: RegExpExecArray | null;
  while ((m = r.exec(text)) !== null) {
    if (m[0].length === 0) {
      r.lastIndex += 1;
      continue;
    }
    fn(m);
  }
}

/** The number is on its own: not inside a longer digit run, not an amount ($123456789, 1,234.50). */
function standaloneNumber(text: string, start: number, end: number): boolean {
  const prev = text[start - 1];
  const next = text[end];
  if (isDigit(prev) || prev === '$') return false;
  if (isDigit(next)) return false;
  if ((next === '.' || next === ',') && isDigit(text[end + 1])) return false;
  if ((prev === '.' || prev === ',') && isDigit(text[start - 2])) return false;
  return true;
}

function digitsIn(s: string): number {
  return s.replace(/\D/g, '').length;
}

type Rule = { priority: number; find: (text: string) => Span[] };

/** Priority: lower wins when two rules find overlapping text (a card number beats a phone-looking part of it). */
const RULES: Rule[] = [
  {
    priority: 1,
    find(text) {
      const out: Span[] = [];
      each(/\d(?:[ -]?\d){12,18}/g, text, (m) => {
        const end = m.index + m[0].length;
        const n = digitsIn(m[0]);
        if (n >= 13 && n <= 19 && standaloneNumber(text, m.index, end)) out.push({ start: m.index, end, label: 'card number' });
      });
      return out;
    },
  },
  {
    priority: 2,
    find(text) {
      const out: Span[] = [];
      each(/(?:cvv2?|cvc2?|csc|security code|card code)\W{0,12}(\d{3,4})(?!\d)/gi, text, (m) => {
        const end = m.index + m[0].length;
        out.push({ start: end - m[1].length, end, label: 'card security code' });
      });
      return out;
    },
  },
  {
    priority: 3,
    find(text) {
      const out: Span[] = [];
      const re = /(?:exp(?:iry|ires|iration)?(?: date)?|valid (?:thru|through|until)|good thru)\W{0,12}((?:0?[1-9]|1[0-2])\s?\/\s?(?:\d{4}|\d{2}))(?!\d)/gi;
      each(re, text, (m) => {
        const end = m.index + m[0].length;
        out.push({ start: end - m[1].length, end, label: 'card expiry' });
      });
      return out;
    },
  },
  {
    // 9-digit IDs: SIN (123-456-789) and other 9-digit numbers such as the Saskatchewan and Alberta health numbers.
    priority: 4,
    find(text) {
      const out: Span[] = [];
      each(/\d{3}[ -]\d{3}[ -]\d{3}(?![ -]?\d)/g, text, (m) => {
        const end = m.index + m[0].length;
        if (standaloneNumber(text, m.index, end)) out.push({ start: m.index, end, label: 'id number' });
      });
      each(/\d{9}/g, text, (m) => {
        const end = m.index + 9;
        if (standaloneNumber(text, m.index, end)) out.push({ start: m.index, end, label: 'id number' });
      });
      return out;
    },
  },
  {
    // Provincial health numbers: Ontario / Nova Scotia (4-3-3 with optional version letters), BC (10 digits starting with 9),
    // Quebec (4 letters + 8 digits).
    priority: 5,
    find(text) {
      const out: Span[] = [];
      each(/\d{4}[ -]\d{3}[ -]\d{3}(?:[ -]?[A-Za-z]{2})?/g, text, (m) => {
        const end = m.index + m[0].length;
        if (standaloneNumber(text, m.index, m.index + 12) && !isAlnum(text[end])) out.push({ start: m.index, end, label: 'health card number' });
      });
      each(/\d{10}[A-Za-z]{2}/g, text, (m) => {
        const end = m.index + m[0].length;
        if (!isDigit(text[m.index - 1]) && !isAlnum(text[end])) out.push({ start: m.index, end, label: 'health card number' });
      });
      each(/9\d{9}/g, text, (m) => {
        const end = m.index + 10;
        if (standaloneNumber(text, m.index, end)) out.push({ start: m.index, end, label: 'health card number' });
      });
      each(/[A-Z]{4}[ -]?\d{4}[ -]?\d{4}/g, text, (m) => {
        const end = m.index + m[0].length;
        if (!isAlnum(text[m.index - 1]) && !isAlnum(text[end])) out.push({ start: m.index, end, label: 'health card number' });
      });
      return out;
    },
  },
  {
    priority: 6,
    find(text) {
      const out: Span[] = [];
      each(/(?:\+?1[ .-]?)?(?:\(\d{3}\)|\d{3})[ .-]?\d{3}[ .-]?\d{4}/g, text, (m) => {
        const end = m.index + m[0].length;
        const n = digitsIn(m[0]);
        if ((n === 10 || n === 11) && standaloneNumber(text, m.index, end)) out.push({ start: m.index, end, label: 'phone number' });
      });
      return out;
    },
  },
  {
    priority: 7,
    find(text) {
      const out: Span[] = [];
      each(/[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z][ -]?\d[ABCEGHJ-NPRSTV-Z]\d/gi, text, (m) => {
        const end = m.index + m[0].length;
        if (!isAlnum(text[m.index - 1]) && !isAlnum(text[end])) out.push({ start: m.index, end, label: 'postal code' });
      });
      return out;
    },
  },
  {
    // "Your code is 482913", "PIN 1234", "one-time passcode: 556677". Only the digits are hidden.
    priority: 8,
    find(text) {
      const out: Span[] = [];
      each(/\b(?:code|pin|passcode|otp)\b[^\d\n]{0,15}?(\d{4,8})(?!\d)/gi, text, (m) => {
        const end = m.index + m[0].length;
        out.push({ start: end - m[1].length, end, label: 'code or pin' });
      });
      return out;
    },
  },
  {
    // jsmith@example.ca: the name part is hidden, the domain stays visible.
    priority: 9,
    find(text) {
      const out: Span[] = [];
      each(/[A-Za-z0-9._%+-]+(?=@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g, text, (m) => {
        out.push({ start: m.index, end: m.index + m[0].length, label: 'email name' });
      });
      return out;
    },
  },
  {
    // bit.ly/3xYz9Ab?id=88213: the domain stays visible, the path and tracking code are hidden.
    priority: 10,
    find(text) {
      const out: Span[] = [];
      each(/(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,24}(\/[^\s]*|\?[^\s]*)/gi, text, (m) => {
        let tail = m[1];
        tail = tail.replace(/[.,;:!?)\]'"\u201d\u2019]+$/, '');
        if (tail.length < 6) return;
        const end = m.index + m[0].length - (m[1].length - tail.length);
        if (text[m.index - 1] === '@') return;
        out.push({ start: end - tail.length, end, label: 'link code' });
      });
      return out;
    },
  },
  {
    // Birth dates: with a cue word (DOB, born), or any full date with a year from 1900 to 2010 (a deadline is never that old).
    priority: 11,
    find(text) {
      const out: Span[] = [];
      const date = `(?:\\d{4}[-/.]\\d{1,2}[-/.]\\d{1,2}|\\d{1,2}[-/.]\\d{1,2}[-/.]\\d{2,4}|${MONTH}\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+\\d{4}|\\d{1,2}(?:st|nd|rd|th)?\\s+${MONTH}\\.?,?\\s+\\d{4})`;
      each(new RegExp(`\\b(?:dob|d\\.o\\.b\\.?|date of birth|birth ?date|birthday|born)\\b(?: on)?[:\\s-]{0,6}(${date})`, 'gi'), text, (m) => {
        const end = m.index + m[0].length;
        out.push({ start: end - m[1].length, end, label: 'birth date' });
      });
      const old = '(?:19\\d{2}|200\\d|2010)';
      each(
        new RegExp(`\\b(?:${old}[-/.]\\d{1,2}[-/.]\\d{1,2}|\\d{1,2}[-/.]\\d{1,2}[-/.]${old}|${MONTH}\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+${old})\\b`, 'gi'),
        text,
        (m) => out.push({ start: m.index, end: m.index + m[0].length, label: 'birth date' }),
      );
      return out;
    },
  },
  {
    // 123 Maple Street, 45 Elm St. Unit 4. The house number is part of the hidden address.
    priority: 12,
    find(text) {
      const out: Span[] = [];
      const suffix = 'Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Boulevard|Blvd|Crescent|Cres|Court|Ct|Lane|Ln|Way|Place|Pl|Terrace|Trail|Circle|Highway|Hwy|Rue|Chemin';
      const re = new RegExp(`\\d{1,5}(?:-\\d{1,5})?\\s+(?:[A-Z][A-Za-z'\u2019.-]*\\s+){1,3}(?:${suffix})\\b\\.?(?:,?\\s+(?:Unit|Apt|Suite|#)\\s*\\w+)?`, 'g');
      each(re, text, (m) => {
        if (isDigit(text[m.index - 1]) || text[m.index - 1] === '$') return;
        out.push({ start: m.index, end: m.index + m[0].length, label: 'address' });
      });
      return out;
    },
  },
];

const NOT_NAMES = new Set(
  ['there', 'everyone', 'all', 'team', 'sir', 'madam', 'customer', 'valued', 'member', 'friend', 'user', 'grandma', 'grandpa', 'mom', 'dad', 'mum', 'nana', 'papa', 'again', 'and', 'the', 'your', 'our'],
);

/**
 * Likely names, from simple cues: Mr/Mrs/Dr + surname, "Hi Dorothy", "my name is", "I'm Jake", a sign-off name.
 * This is a helper, not a name finder: it misses names with no cue. The person reviews everything before it is sent.
 */
function findLikelyNames(text: string): Span[] {
  const out: Span[] = [];
  const push = (m: RegExpExecArray) => {
    const group = m[1];
    const first = group.split(/\s+/)[0].toLowerCase();
    if (NOT_NAMES.has(first)) return;
    const end = m.index + m[0].length;
    out.push({ start: end - group.length, end, label: 'name' });
  };
  each(new RegExp(`\\b(?:Mr|Mrs|Ms|Miss|Mx|Dr|Prof|Mme|Mlle)\\.?\\s+(${NAME}(?:\\s+${NAME})?)`, 'g'), text, push);
  each(new RegExp(`\\b(?:Hi|Hello|Hey|Dear|Good (?:morning|afternoon|evening)),?\\s+(${NAME}(?:\\s+${NAME})?)`, 'g'), text, push);
  each(new RegExp(`\\b(?:[Mm]y name is|I am|I'm|I\u2019m)\\s+(${NAME}(?:\\s+${NAME})?)`, 'g'), text, push);
  each(new RegExp(`\\b(?:Thanks|Thank you|Regards|Sincerely|Best|Love|Cheers|Yours)[,.]?[ \\t]*[\\r\\n]+[ \\t]*(${NAME}(?:\\s+${NAME})?)`, 'g'), text, push);
  return out;
}

/** Drops overlapping spans, keeping the more specific rule first, then the longer one. Result is sorted by start. */
export function resolveOverlaps(spans: Array<Span & { priority?: number }>): Span[] {
  const ranked = spans
    .map((s, i) => ({ s, i }))
    .sort((a, b) => (a.s.priority ?? 99) - (b.s.priority ?? 99) || b.s.end - b.s.start - (a.s.end - a.s.start) || a.i - b.i);
  const kept: Span[] = [];
  for (const { s } of ranked) {
    if (kept.some((k) => s.start < k.end && s.end > k.start)) continue;
    kept.push({ start: s.start, end: s.end, label: s.label });
  }
  return kept.sort((a, b) => a.start - b.start);
}

/** Finds Canadian personal details in a piece of text. Optional extra spans (for example from a name finder) are merged in. */
export function findCanadianPii(text: string, extra: Span[] = []): Span[] {
  const all: Array<Span & { priority: number }> = [];
  for (const rule of RULES) for (const s of rule.find(text)) all.push({ ...s, priority: rule.priority });
  for (const s of findLikelyNames(text)) all.push({ ...s, priority: 13 });
  for (const s of extra) all.push({ ...s, priority: 14 });
  return resolveOverlaps(all);
}
