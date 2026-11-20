// Check It: Canadian redaction rules.
//
// Runs on the text that image-pii-redactor reads from a screenshot (OCR), on the
// person's phone, before anything is sent. Two goals:
//   1. Hide the person's own details, in Canadian formats.
//   2. Keep the scam's clues visible (amounts, deadlines, the link's domain,
//      the sender's email domain), because the AI check needs them.
//
// Patterns adapted from (see THIRD_PARTY_NOTICES.md):
//   - Microsoft Presidio (MIT): CA_SIN, CA_POSTAL_CODE recognizers
//   - canpii (Apache-2.0): OHIP, BC PHN, AB PHN, RAMQ patterns; Luhn and BC MOD-11 checks
//   - wuming (MIT): Canadian phone, SIN, email and credit card patterns
// Changes from the originals: privacy-first matching (we hide any 9-digit ID,
// not only valid SINs), context windows instead of scores, partial hiding for
// emails and links, and rules for card expiry, CVV, one-time codes and birth dates.

import type { CaMatch, CaRuleId, KeepZone } from './types';

// ---------- checks ----------

/** Luhn (mod 10) check. Adapted from canpii validators.luhn_valid. */
export function luhnValid(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false;
  let total = 0;
  for (let i = 0; i < digits.length; i++) {
    let n = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    total += n;
  }
  return total % 10 === 0;
}

const BC_PHN_WEIGHTS = [2, 4, 8, 5, 10, 9, 7, 3];

/** BC Personal Health Number MOD-11 check. Adapted from canpii validators.bc_phn_valid. */
export function bcPhnValid(digits: string): boolean {
  if (!/^9\d{9}$/.test(digits)) return false;
  let total = 0;
  for (let i = 0; i < 8; i++) total += (Number(digits[i + 1]) * BC_PHN_WEIGHTS[i]) % 11;
  const check = 11 - (total % 11);
  return check <= 9 && check === Number(digits[9]);
}

const onlyDigits = (s: string) => s.replace(/\D/g, '');
const windowBefore = (text: string, index: number, size: number) =>
  text.slice(Math.max(0, index - size), index);

// ---------- context words ----------

const SIN_CONTEXT = /\b(sin|s\.i\.n|social insurance|nas|assurance sociale)\b/i;
const HEALTH_CONTEXT = /\b(health|sant[ée]|card|carte|hsn|phn|ohip|ramq|ahcip|msp)\b/i;
const EXPIRY_CONTEXT = /\b(exp|expiry|expires|expiration|valid\s*(thru|through|until)|good\s*thru)\b/i;
const CVV_CONTEXT = /\b(cvv|cvc|cvn|csc|security code|3[- ]digit|three[- ]digit)\b/i;
const CODE_CONTEXT = /\b(code|pin|passcode|password|otp|verification|verify|one[- ]time|security)\b/i;
const BIRTH_CONTEXT = /\b(birth|born|dob|d\.o\.b|naissance)\b/i;

// ---------- the rules ----------

interface RuleResult {
  matches: CaMatch[];
  keep: KeepZone[];
}

function add(out: CaMatch[], rule: CaRuleId, label: string, start: number, end: number, text: string) {
  if (end > start) out.push({ rule, label, start, end, text: text.slice(start, end) });
}

/** Rule 1: SIN, or any 3-3-3 / 9-digit ID (Saskatchewan, Alberta, Manitoba health numbers are 9 digits).
 *  Pattern shape from Presidio CA_SIN and wuming ca/sin; Presidio's [1-79] first digit and
 *  Luhn requirement are dropped on purpose, so nothing that looks like an ID slips through. */
function ruleNineDigitId(text: string, out: CaMatch[]) {
  const re = /(?<![\d$])\d{3}([- ]?)\d{3}\1\d{3}(?!\d)/g;
  for (const m of text.matchAll(re)) {
    const before = windowBefore(text, m.index, 40);
    const label = SIN_CONTEXT.test(before)
      ? 'SIN'
      : HEALTH_CONTEXT.test(before)
        ? 'health card number'
        : 'ID number';
    add(out, 'CA_SIN_OR_9_DIGIT_ID', label, m.index, m.index + m[0].length, text);
  }
}

/** Rule 2: postal code A1A 1A1. Letter sets from Presidio CA_POSTAL_CODE (Canada Post never uses D F I O Q U; W Z never first). */
function rulePostalCode(text: string, out: CaMatch[]) {
  const re = /\b[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z][ -]?\d[ABCEGHJ-NPRSTV-Z]\d\b/gi;
  for (const m of text.matchAll(re)) {
    // Must contain letters and digits in the right places (the /i flag allows lowercase OCR output).
    add(out, 'CA_POSTAL_CODE', 'postal code', m.index, m.index + m[0].length, text);
  }
}

/** Rule 3: other provincial health numbers. Shapes from canpii:
 *  OHIP / BC PHN 4-3-3 (+ OHIP version code), solid 10 digits, Alberta 5-4, Quebec RAMQ (4 letters + 8 digits). */
function ruleHealthNumber(text: string, out: CaMatch[]) {
  const patterns = [
    /(?<![\d$])\d{4}[- ]\d{3}[- ]\d{3}(?:[- ]?[A-Z]{1,2})?(?![\dA-Za-z])/g, // OHIP, BC PHN grouped
    /(?<![\d$])\d{10}(?![\d])/g, // solid 10 digits (also caught by the phone rule if it looks like one)
    /(?<!\d)\d{5}-\d{4}(?!\d)/g, // Alberta 5-4
    /\b[A-Z]{4}[ -]?\d{4}[ -]?\d{4}\b/g, // Quebec RAMQ
  ];
  for (const re of patterns) {
    for (const m of text.matchAll(re)) {
      const digits = onlyDigits(m[0]);
      const label =
        HEALTH_CONTEXT.test(windowBefore(text, m.index, 40)) || bcPhnValid(digits)
          ? 'health card number'
          : 'ID number';
      add(out, 'CA_HEALTH_NUMBER', label, m.index, m.index + m[0].length, text);
    }
  }
}

/** Rule 4: North American phone numbers, all common formats. Adapted from wuming ca/phone. */
function rulePhone(text: string, out: CaMatch[]) {
  const re =
    /(?<![\w])(?:\+?1[\s.\-]?)?(?:\([2-9]\d{2}\)|[2-9]\d{2})[\s.\-]?\d{3}[\s.\-]?\d{4}(?:\s*(?:ext\.?|x)\s*\d{1,5})?(?!\d)/gi;
  for (const m of text.matchAll(re)) {
    add(out, 'PHONE_NANP', 'phone number', m.index, m.index + m[0].length, text);
  }
}

/** Rule 5: payment card number (13–19 digits, Luhn-checked), plus expiry date and CVV when labelled.
 *  Card shape from wuming common/creditcard; Luhn from canpii. */
function rulePaymentCard(text: string, out: CaMatch[]) {
  const cardEnds: number[] = [];
  for (const m of text.matchAll(/(?<!\d)\d(?:[ -]?\d){12,18}(?!\d)/g)) {
    const digits = onlyDigits(m[0]);
    if (digits.length >= 13 && digits.length <= 19 && luhnValid(digits)) {
      add(out, 'PAYMENT_CARD', 'card number', m.index, m.index + m[0].length, text);
      cardEnds.push(m.index + m[0].length);
    }
  }
  for (const m of text.matchAll(/(?<![\d/])(0?[1-9]|1[0-2])\s?[/\-]\s?(\d{2}|20\d{2})(?![\d/])/g)) {
    const nearCard = cardEnds.some((e) => m.index - e >= 0 && m.index - e <= 20);
    if (nearCard || EXPIRY_CONTEXT.test(windowBefore(text, m.index, 20))) {
      add(out, 'PAYMENT_CARD', 'card expiry', m.index, m.index + m[0].length, text);
    }
  }
  for (const m of text.matchAll(/(?<![\d$.,])\d{3,4}(?![\d.,])/g)) {
    if (CVV_CONTEXT.test(windowBefore(text, m.index, 20))) {
      add(out, 'PAYMENT_CARD', 'card security code', m.index, m.index + m[0].length, text);
    }
  }
}

/** Rule 6: one-time codes and PINs: 4–8 digits (or 3+3) near "code", "PIN", "verification"… Never amounts. */
function ruleCode(text: string, out: CaMatch[]) {
  const re = /(?<![\d$.,])(?:\d{3}[ -]\d{3}|\d{4,8})(?![\d.,%]|\s?\$)/g;
  for (const m of text.matchAll(re)) {
    if (CODE_CONTEXT.test(windowBefore(text, m.index, 40))) {
      add(out, 'ONE_TIME_CODE_OR_PIN', 'code', m.index, m.index + m[0].length, text);
    }
  }
}

/** Rule 7: email: hide the name part (before @), keep the domain as a clue. Pattern from wuming common/email. */
function ruleEmail(text: string, out: CaMatch[], keep: KeepZone[]) {
  const re = /[A-Za-z0-9._%+\-]+@([A-Za-z0-9.\-]+\.[A-Za-z]{2,})/g;
  for (const m of text.matchAll(re)) {
    const at = m.index + m[0].indexOf('@');
    add(out, 'EMAIL_LOCAL_PART', 'email name', m.index, at + 1, text);
    keep.push({ start: at + 1, end: m.index + m[0].length });
  }
}

/** Rule 8: links: keep the domain (and a plain first word like /track), hide tracking codes,
 *  including the part that wrapped onto the next line. */
function ruleLink(text: string, out: CaMatch[], keep: KeepZone[]) {
  const re =
    /(?<![@\w.\-])(?:https?:\/\/)?(?:www\.)?((?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,})((?:[/?#][^\s<>"']*)?)/gi;
  for (const m of text.matchAll(re)) {
    const rest = m[2] ?? '';
    const domainEnd = m.index + m[0].length - rest.length;
    keep.push({ start: m.index, end: domainEnd });

    // Trailing sentence punctuation is not part of the link.
    const restTrimmed = rest.replace(/[.,;:!)]+$/, '');
    const firstSegment = restTrimmed.match(/^\/[A-Za-z][A-Za-z-]{0,24}(?=$|[/?#])/);
    const keptLen = firstSegment ? firstSegment[0].length : 0;
    if (keptLen) keep.push({ start: domainEnd, end: domainEnd + keptLen });

    const hideStart = domainEnd + keptLen;
    let hideEnd = domainEnd + restTrimmed.length;
    if (hideEnd > hideStart) {
      add(out, 'LINK_TRACKING', 'link code', hideStart, hideEnd, text);
    }

    // Wrapped link: the next line starts with the rest of the link.
    const after = m.index + m[0].length;
    if (text[after] === '\n' && rest.length > 0) {
      const next = text.slice(after + 1).match(/^[^\s]+/);
      const token = next?.[0] ?? '';
      const looksLikeLinkTail = /^[?#&=/]/.test(token) || (/\d/.test(token) && /^[A-Za-z0-9=&%_\-./?#]+$/.test(token));
      if (token && token.length <= 60 && looksLikeLinkTail) {
        add(out, 'LINK_TRACKING', 'link code', after + 1, after + 1 + token.length, text);
      }
    }
  }
}

/** Rule 9: date of birth: a full date (with year) right after "birth", "born" or "DOB". Deadlines stay visible. */
function ruleBirthDate(text: string, out: CaMatch[]) {
  const month = '(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?';
  const re = new RegExp(
    `\\b(?:${month}\\s+\\d{1,2},?\\s+(?:19|20)\\d{2}|\\d{1,2}\\s+${month}\\s+(?:19|20)\\d{2}|(?:19|20)\\d{2}[-/.]\\d{1,2}[-/.]\\d{1,2}|\\d{1,2}[-/.]\\d{1,2}[-/.](?:19|20)\\d{2})\\b`,
    'gi',
  );
  for (const m of text.matchAll(re)) {
    if (BIRTH_CONTEXT.test(windowBefore(text, m.index, 30))) {
      add(out, 'DATE_OF_BIRTH', 'birth date', m.index, m.index + m[0].length, text);
    }
  }
}

// ---------- combine ----------

/** Merge overlapping spans so each region is hidden once. The longer match names the region. */
function mergeOverlaps(matches: CaMatch[], text: string): CaMatch[] {
  const sorted = [...matches].sort((a, b) => a.start - b.start || b.end - a.end);
  const merged: CaMatch[] = [];
  for (const m of sorted) {
    const prev = merged[merged.length - 1];
    if (prev && m.start < prev.end) {
      if (m.end - m.start > prev.end - prev.start) {
        prev.rule = m.rule;
        prev.label = m.label;
      }
      prev.end = Math.max(prev.end, m.end);
      prev.text = text.slice(prev.start, prev.end);
    } else {
      merged.push({ ...m });
    }
  }
  return merged;
}

/** Find everything our Canadian rules want hidden, and the clue zones to keep visible. */
export function findCanadianPii(text: string): RuleResult {
  const out: CaMatch[] = [];
  const keep: KeepZone[] = [];
  ruleNineDigitId(text, out);
  rulePostalCode(text, out);
  ruleHealthNumber(text, out);
  rulePhone(text, out);
  rulePaymentCard(text, out);
  ruleCode(text, out);
  ruleEmail(text, out, keep);
  ruleLink(text, out, keep);
  ruleBirthDate(text, out);
  return { matches: mergeOverlaps(out, text), keep };
}

/** Text with our matches replaced by [label]. Used in tests and as a fallback for the paste path. */
export function redactText(text: string): string {
  const { matches } = findCanadianPii(text);
  let result = '';
  let last = 0;
  for (const m of matches) {
    result += text.slice(last, m.start) + `[${m.label}]`;
    last = m.end;
  }
  return result + text.slice(last);
}
