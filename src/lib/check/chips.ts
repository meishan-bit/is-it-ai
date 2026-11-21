import type { Box, OcrWord, Span } from './types';
import { isRedactionLabel } from './labels';

/**
 * Review chips. Every word (or detected detail) becomes one chip the person can tap to hide or show.
 * Photo chips carry the boxes to black out; text chips carry character offsets for the masked copy.
 */
export interface Chip {
  id: string;
  text: string;
  /** Label of the detail we found, or null for an ordinary word. */
  label: string | null;
  /** True when we hid it automatically. */
  auto: boolean;
  hidden: boolean;
  boxes: Box[];
  start: number;
  end: number;
}

const hasContent = (s: string) => /[A-Za-z0-9\u00C0-\u024F]/.test(s);

/** Chips for pasted text: a chip for each detail we found and for each remaining word. */
export function chipsFromText(text: string, spans: Span[]): Chip[] {
  const chips: Chip[] = [];
  let cursor = 0;
  const addWords = (from: number, to: number) => {
    const gap = text.slice(from, to);
    const re = /\S+/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(gap)) !== null) {
      if (!hasContent(m[0])) continue; // a lone comma or full stop is not worth a chip; it stays in the text as it is
      const start = from + m.index;
      chips.push({ id: `c${chips.length}`, text: m[0], label: null, auto: false, hidden: false, boxes: [], start, end: start + m[0].length });
    }
  };
  for (const s of [...spans].sort((a, b) => a.start - b.start)) {
    if (s.start < cursor) continue;
    addWords(cursor, s.start);
    chips.push({ id: `c${chips.length}`, text: text.slice(s.start, s.end), label: s.label, auto: true, hidden: true, boxes: [], start: s.start, end: s.end });
    cursor = s.end;
  }
  addWords(cursor, text.length);
  return chips;
}

/** Joins OCR words into text in reading order, so rules written for text can run on a photo. */
export function wordsToText(words: OcrWord[]): { text: string; offsets: Array<{ start: number; end: number }> } {
  let text = '';
  const offsets: Array<{ start: number; end: number }> = [];
  let lastLine = -1;
  words.forEach((w, i) => {
    if (i > 0) text += w.line !== lastLine ? '\n' : ' ';
    const start = text.length;
    text += w.text;
    offsets.push({ start, end: text.length });
    lastLine = w.line;
  });
  return { text, offsets };
}

/**
 * Chips for a photo. A detail that covers several words (a card number, an address) is one chip with several boxes.
 * A detail that covers only part of a word hides the whole word, because a photo cannot hide half a word.
 */
export function chipsFromWords(words: OcrWord[], spans: Span[]): Chip[] {
  const { offsets } = wordsToText(words);
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  const chips: Chip[] = [];
  let i = 0;
  while (i < words.length) {
    const o = offsets[i];
    const span = sorted.find((s) => o.start < s.end && o.end > s.start);
    if (span) {
      const members: number[] = [];
      let j = i;
      while (j < words.length && offsets[j].start < span.end && offsets[j].end > span.start) {
        members.push(j);
        j += 1;
      }
      chips.push({
        id: `c${chips.length}`,
        text: members.map((k) => words[k].text).join(' '),
        label: span.label,
        auto: true,
        hidden: true,
        boxes: members.map((k) => words[k].bbox),
        start: offsets[members[0]].start,
        end: offsets[members[members.length - 1]].end,
      });
      i = j;
    } else {
      if (hasContent(words[i].text)) {
        chips.push({ id: `c${chips.length}`, text: words[i].text, label: null, auto: false, hidden: false, boxes: [words[i].bbox], start: o.start, end: o.end });
      }
      i += 1;
    }
  }
  return chips;
}

export function toggleChip(chips: Chip[], id: string): Chip[] {
  return chips.map((c) => (c.id === id ? { ...c, hidden: !c.hidden } : c));
}

/** The pasted text with every hidden chip replaced by its label, for example "[card number]" or "[hidden]". */
export function maskedText(text: string, chips: Chip[]): string {
  let out = '';
  let cursor = 0;
  for (const c of [...chips].sort((a, b) => a.start - b.start)) {
    out += text.slice(cursor, c.start);
    out += c.hidden ? `[${c.label ?? 'hidden'}]` : text.slice(c.start, c.end);
    cursor = c.end;
  }
  return out + text.slice(cursor);
}

export function hiddenBoxes(chips: Chip[]): Box[] {
  return chips.filter((c) => c.hidden).flatMap((c) => c.boxes);
}

/** Counts for check_events: what we found, and how often the person changed our choice. Counts only, never content. */
export function chipStats(chips: Chip[]): { redaction_counts: Record<string, number>; user_unhid_count: number; user_added_count: number } {
  const redaction_counts: Record<string, number> = {};
  let unhid = 0;
  let added = 0;
  for (const c of chips) {
    if (c.auto) {
      const key = c.label && isRedactionLabel(c.label) ? c.label : null;
      if (key) redaction_counts[key] = (redaction_counts[key] ?? 0) + 1;
      if (!c.hidden) unhid += 1;
    } else if (c.hidden) added += 1;
  }
  return { redaction_counts, user_unhid_count: unhid, user_added_count: added };
}
