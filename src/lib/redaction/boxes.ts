// Check It: turn text matches into boxes on the screenshot, and clean up the
// name detector's mistakes. Pure functions, no browser APIs, so they run in tests.

import type { BBox, KeepZone, LibraryEntity, OcrResult, OcrWord, Redaction } from './types';

const PAD_PX = 3;

/** Labels from image-pii-redactor we never use: our own rules handle these
 *  (and keep the domain visible), or they hide scam clues. */
const DROP_LABELS = new Set(['EMAIL', 'URL', 'USERNAME', 'IP_ADDRESS', 'DATE', 'TIME', 'ACCOUNTNUM']);

/** Short words the detector sometimes boxes by mistake ("at", "us"). */
const STOPWORDS = new Set([
  'a', 'an', 'and', 'at', 'by', 'for', 'from', 'in', 'is', 'it', 'me', 'my', 'of', 'on', 'or', 'the', 'to', 'us', 'we', 'you',
]);

const MONEY = /\$\s?\d|\d[\d,]*\.\d{2}\b|\bdollars?\b|\bCAD\b/i;

/** Status bar at the top of a phone screenshot (time, signal, battery). */
function inStatusBar(box: BBox, ocr: OcrResult): boolean {
  const tallScreenshot = ocr.imageHeight / Math.max(1, ocr.imageWidth) > 1.7;
  return tallScreenshot && box.y1 < ocr.imageHeight * 0.045;
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function wordsInSpan(words: OcrWord[], start: number, end: number): OcrWord[] {
  return words.filter((w) => overlaps(w.charStart, w.charEnd, start, end));
}

function merge(boxes: BBox[]): BBox {
  return {
    x0: Math.min(...boxes.map((b) => b.x0)),
    y0: Math.min(...boxes.map((b) => b.y0)),
    x1: Math.max(...boxes.map((b) => b.x1)),
    y1: Math.max(...boxes.map((b) => b.y1)),
  };
}

/**
 * Boxes for a character span, one per line. Handles spans that start or end
 * inside a word (an email's name part, a link's tracking code) by cutting the
 * word's box in proportion to its characters. At a cut, the box reaches half a
 * character further, so nothing of the hidden part peeks out.
 */
export function spanToBoxes(
  words: OcrWord[],
  start: number,
  end: number,
  size: { imageWidth: number; imageHeight: number },
): BBox[] {
  const byLine = new Map<number, BBox[]>();
  for (const w of wordsInSpan(words, start, end)) {
    const len = Math.max(1, w.charEnd - w.charStart);
    const charW = (w.bbox.x1 - w.bbox.x0) / len;
    const from = Math.max(start, w.charStart) - w.charStart;
    const to = Math.min(end, w.charEnd) - w.charStart;
    const x0 = w.bbox.x0 + from * charW - (from > 0 ? charW / 2 : 0);
    const x1 = w.bbox.x0 + to * charW + (to < len ? charW / 2 : 0);
    const list = byLine.get(w.lineIndex) ?? [];
    list.push({ x0, y0: w.bbox.y0, x1, y1: w.bbox.y1 });
    byLine.set(w.lineIndex, list);
  }
  return [...byLine.values()].map((boxes) => {
    const b = merge(boxes);
    return {
      x0: Math.max(0, Math.floor(b.x0 - PAD_PX)),
      y0: Math.max(0, Math.floor(b.y0 - PAD_PX)),
      x1: Math.min(size.imageWidth, Math.ceil(b.x1 + PAD_PX)),
      y1: Math.min(size.imageHeight, Math.ceil(b.y1 + PAD_PX)),
    };
  });
}

/**
 * Keep only the name detector's findings that are personal details.
 * Drops: our-rule labels, money amounts, anything over a kept clue (link or email domain),
 * stray short words, and items in the phone's status bar.
 */
export function filterLibraryEntities(
  entities: LibraryEntity[],
  ocr: OcrResult,
  keep: KeepZone[],
): LibraryEntity[] {
  return entities.filter((e) => {
    if (DROP_LABELS.has(e.label)) return false;
    if (MONEY.test(e.text)) return false;
    if (keep.some((k) => overlaps(e.start, e.end, k.start, k.end))) return false;
    const bare = e.text.replace(/[^\p{L}\p{N}]/gu, '').toLowerCase();
    if (bare.length < 2 || STOPWORDS.has(bare)) return false;
    const words = wordsInSpan(ocr.words, e.start, e.end);
    if (words.length && words.every((w) => inStatusBar(w.bbox, ocr))) return false;
    return true;
  });
}

/** The house number just before a street name ("142" in "142 Willow Crescent"), if any. */
export function houseNumberBefore(words: OcrWord[], streetStart: number): OcrWord | undefined {
  const first = words.find((w) => w.charStart <= streetStart && streetStart < w.charEnd);
  if (!first) return undefined;
  const prev = words
    .filter((w) => w.lineIndex === first.lineIndex && w.charEnd <= first.charStart)
    .sort((a, b) => b.charEnd - a.charEnd)[0];
  return prev && /^\d{1,6}[A-Za-z]?$/.test(prev.text) ? prev : undefined;
}

/** Boxes in the shape image-pii-redactor draws. */
export function toRedactions(boxes: BBox[], idPrefix: string, label: string): Redaction[] {
  return boxes.map((bbox, i) => ({ id: `${idPrefix}-${i}`, bbox, source: 'auto', enabled: true, label }));
}
