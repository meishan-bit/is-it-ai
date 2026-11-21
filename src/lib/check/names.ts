import type { OcrWord, Span } from './types';
import { findKeepZones } from './ca-patterns';
import { wordsToText } from './chips';

/**
 * Name finder for Check It. Runs on the phone, on text only: nothing is sent anywhere to find names.
 *
 * Uses compromise (MIT, about 150 KB), loaded only when Check It needs it. It finds names that have no cue word
 * ("Thank you Robert", "Barbara, this is Kevin"), which the simple cues in ca-patterns.ts miss.
 * PR #1 used image-pii-redactor's AI model instead; it was dropped because it downloads 279 MB to each phone.
 *
 * compromise contains a look-behind, so older iPhones (before iOS 16.4) cannot load it. Because it is loaded on demand,
 * that only makes the load fail: findNames() then returns nothing and the cue-based names and the review screen still work.
 *
 * The clean-up filters (amounts, short words, link and email domains, the phone's status bar) are from PR #1's Android test.
 */

type Doc = { people(): { out(format: 'offset'): Array<{ offset: { start: number; length: number } }> } };
type Nlp = (text: string) => Doc;

let loading: Promise<Nlp> | null = null;

/** Starts loading the name finder. Safe to call many times. */
export function loadNameFinder(): Promise<Nlp> {
  if (!loading) {
    loading = import('compromise')
      .then((mod) => ((mod as unknown as { default?: Nlp }).default ?? (mod as unknown as Nlp)))
      .catch((err) => {
        loading = null;
        throw err;
      });
  }
  return loading;
}

/** Ordinary words and forms of address that are never a person's own name. */
const NOT_NAMES = new Set([
  'a', 'an', 'and', 'at', 'by', 'for', 'from', 'in', 'is', 'it', 'me', 'my', 'of', 'on', 'or', 'the', 'to', 'us', 'we', 'you',
  'there', 'everyone', 'all', 'team', 'sir', 'madam', 'customer', 'valued', 'member', 'friend', 'user',
  'grandma', 'grandpa', 'grandson', 'granddaughter', 'mom', 'dad', 'mum', 'nana', 'papa', 'honey', 'dear',
]);
const TITLE = /^(?:Mr|Mrs|Ms|Miss|Mx|Dr|Prof|Mme|Mlle)\.?\s+/;
const MONEY = /\$\s?\d|\d[\d,]*\.\d{2}\b|\bdollars?\b|\bCAD\b/i;

/**
 * Tidies the finder's raw spans: trims punctuation and titles ("Mr. Davies," -> "Davies"), and drops amounts, short or
 * ordinary words, lowercase words and anything touching a link or email domain (those are scam clues and stay visible).
 */
export function cleanNameSpans(raw: Array<{ start: number; end: number }>, text: string): Span[] {
  const keep = findKeepZones(text);
  const out: Span[] = [];
  for (const r of raw) {
    let start = r.start;
    let end = Math.min(r.end, text.length);
    while (start < end && !/[\p{L}\p{N}]/u.test(text[start])) start += 1;
    while (end > start && !/[\p{L}\p{N}]/u.test(text[end - 1])) end -= 1;
    const title = TITLE.exec(text.slice(start, end));
    if (title) start += title[0].length;
    const s = text.slice(start, end);
    if (s.length < 2 || !/^\p{Lu}/u.test(s)) continue;
    if (MONEY.test(s)) continue;
    if (s.split(/\s+/).every((w) => NOT_NAMES.has(w.toLowerCase()))) continue;
    if (keep.some((k) => start < k.end && end > k.start)) continue;
    out.push({ start, end, label: 'name' });
  }
  return out;
}

/** Finds likely names in text. Returns [] if the finder cannot load or fails, so Check It never stops because of it. */
export async function findNames(text: string): Promise<Span[]> {
  if (!text.trim()) return [];
  try {
    const nlp = await loadNameFinder();
    const raw = nlp(text)
      .people()
      .out('offset')
      .map((p) => ({ start: p.offset.start, end: p.offset.start + p.offset.length }));
    return cleanNameSpans(raw, text);
  } catch {
    return [];
  }
}

/**
 * Drops names found in the phone's status bar at the top of a screenshot (carrier, clock), which are not the person's details.
 * From PR #1: only for tall screenshots, and only the top 4.5% of the picture.
 */
export function dropStatusBar(spans: Span[], words: OcrWord[], width: number, height: number): Span[] {
  if (height / Math.max(1, width) <= 1.7) return spans;
  const { offsets } = wordsToText(words);
  const limit = height * 0.045;
  return spans.filter((s) => {
    const inSpan = words.filter((_, i) => offsets[i].start < s.end && offsets[i].end > s.start);
    return !(inSpan.length > 0 && inSpan.every((w) => w.bbox.y1 < limit));
  });
}
