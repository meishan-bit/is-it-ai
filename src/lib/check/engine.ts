import type { Box, OcrWord, Span } from './types';
import { findNames, loadNameFinder } from './names';

/**
 * The photo reader. Everything runs on the phone: the picture is read here and never sent for reading.
 * This file is the one place that knows which reader is used, so a different reader can be dropped in
 * (see docs/CHECK_IT.md, "Swapping in the PR #1 redactor") without touching any screen.
 */
export interface PhotoEngine {
  isReady(): boolean;
  /** Loads the reader. onProgress gets plain-word stages and a percent when the reader knows it. */
  warmUp(onProgress?: (p: EngineProgress) => void): Promise<void>;
  /** Reads the words in a picture, with a box for each word, in reading order. */
  recognize(source: HTMLCanvasElement): Promise<OcrWord[]>;
  /** Optional name finder. Spans are offsets into the text passed in. */
  detectNames?(text: string): Promise<Span[]>;
  dispose(): Promise<void>;
}

export interface EngineProgress {
  stage: string;
  percent: number | null;
}

type Listener = (p: EngineProgress) => void;

let engine: PhotoEngine | null = null;
let warming: Promise<void> | null = null;
let last: EngineProgress = { stage: 'Getting the reader ready', percent: null };
const listeners = new Set<Listener>();

/** Lets a different reader be used (and lets tests use a fake one). */
export function setPhotoEngine(e: PhotoEngine | null): void {
  engine = e;
  warming = null;
}

export function getPhotoEngine(): PhotoEngine {
  if (!engine) engine = createTesseractEngine();
  return engine;
}

export function subscribeProgress(fn: Listener): () => void {
  listeners.add(fn);
  fn(last);
  return () => {
    listeners.delete(fn);
  };
}

function emit(p: EngineProgress): void {
  last = p;
  listeners.forEach((fn) => fn(p));
}

/** Starts loading the reader in the background. Safe to call many times: the work happens once. */
export function warmUpPhotoEngine(): Promise<void> {
  const e = getPhotoEngine();
  if (e.isReady()) return Promise.resolve();
  if (!warming) {
    warming = e.warmUp(emit).catch((err) => {
      warming = null;
      throw err;
    });
  }
  return warming;
}

/** Plain words for the loading stages. No file names, no numbers the person cannot use. */
export function plainStage(status: string): string {
  const s = status.toLowerCase();
  if (s.includes('traineddata') || s.includes('language')) return 'Getting the word list ready';
  if (s.includes('recogniz')) return 'Reading the words';
  if (s.includes('core') || s.includes('initializ')) return 'Getting the reader ready';
  return 'Getting the reader ready';
}

/** Groups word boxes into lines by height, so rules written for text can read a photo in order. */
export function assignLines(words: Array<{ text: string; bbox: Box }>): OcrWord[] {
  const sorted = words
    .filter((w) => w.text.trim().length > 0)
    .map((w) => ({ ...w, cy: (w.bbox.y0 + w.bbox.y1) / 2, h: Math.max(1, w.bbox.y1 - w.bbox.y0) }))
    .sort((a, b) => a.cy - b.cy);
  const lines: Array<{ cy: number; h: number; words: typeof sorted }> = [];
  for (const w of sorted) {
    const line = lines.find((l) => Math.abs(l.cy - w.cy) <= Math.max(l.h, w.h) * 0.6);
    if (line) {
      line.words.push(w);
      line.cy = line.words.reduce((a, x) => a + x.cy, 0) / line.words.length;
    } else lines.push({ cy: w.cy, h: w.h, words: [w] });
  }
  lines.sort((a, b) => a.cy - b.cy);
  const out: OcrWord[] = [];
  lines.forEach((l, i) => {
    l.words.sort((a, b) => a.bbox.x0 - b.bbox.x0).forEach((w) => out.push({ text: w.text, bbox: w.bbox, line: i }));
  });
  return out;
}

type TessWord = { text: string; bbox: Box };
type TessWorker = {
  recognize(image: unknown): Promise<{ data: { words?: TessWord[] } }>;
  setParameters(params: Record<string, string>): Promise<unknown>;
  terminate(): Promise<unknown>;
};

const area = (b: Box): number => Math.max(0, b.x1 - b.x0) * Math.max(0, b.y1 - b.y0);
function overlapShare(a: Box, b: Box): number {
  const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
  const h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
  if (w <= 0 || h <= 0) return 0;
  return (w * h) / Math.max(1, Math.min(area(a), area(b)));
}

/**
 * Joins the words from two reads of the same picture. Every word from the first read is kept; a word from the second read
 * is added only where the first read found nothing (it covers less than 30% of any first-read word).
 */
export function mergeWordPasses(first: TessWord[], second: TessWord[]): TessWord[] {
  const out = first.filter((w) => w.text.trim());
  for (const w of second) {
    if (!w.text.trim()) continue;
    if (out.some((k) => overlapShare(k.bbox, w.bbox) > 0.3)) continue;
    out.push(w);
  }
  return out;
}

/**
 * A copy of the picture where each pixel takes its darkest colour channel, then light and dark are swapped.
 * White text on any coloured bubble (blue, green, grey) becomes black text on a light background, so it is read in
 * dark mode too. Black text on a pale coloured bubble (yellow) can fade here; the second read covers that.
 */
export function minChannelInverted(source: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = source.width;
  out.height = source.height;
  const ctx = out.getContext('2d', { willReadFrequently: true });
  if (!ctx) return source;
  ctx.drawImage(source, 0, 0);
  const img = ctx.getImageData(0, 0, out.width, out.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = 255 - Math.min(d[i], d[i + 1], d[i + 2]);
    d[i] = v;
    d[i + 1] = v;
    d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return out;
}
type TessModule = {
  createWorker: (lang: string, oem?: number, options?: { logger?: (m: { status: string; progress: number }) => void }) => Promise<TessWorker>;
};

/**
 * Built-in reader: Tesseract.js (OCR) in the browser. It finds the words and their boxes; the Canadian rules in
 * ca-patterns.ts decide which to hide, and names.ts (compromise) finds names. The person reviews everything before it is sent.
 * The language data downloads once from a public CDN (nothing about the picture is sent there).
 */
function createTesseractEngine(): PhotoEngine {
  let worker: TessWorker | null = null;
  return {
    isReady: () => worker !== null,
    async warmUp(onProgress) {
      if (worker) return;
      void loadNameFinder().catch(() => undefined); // small, loads alongside the reader; failure only means fewer names found
      const mod = (await import('tesseract.js')) as unknown as TessModule;
      worker = await mod.createWorker('eng', 1, {
        logger: (m) => onProgress?.({ stage: plainStage(m.status), percent: Number.isFinite(m.progress) ? Math.round(m.progress * 100) : null }),
      });
      onProgress?.({ stage: 'Ready', percent: 100 });
    },
    /**
     * Reads the picture twice and joins the words, because no single read gets every chat screenshot (Nov 21 phone test):
     *   1. the min-channel copy: catches white text on coloured bubbles (a blue reply bubble in dark mode was missed entirely);
     *   2. the original with adaptive thresholding: catches dark text on pale coloured bubbles, which read 1 can fade.
     * Adaptive thresholding alone missed the sender's phone number at the top of a dark screenshot, so read 1 comes first.
     */
    async recognize(source) {
      const w = worker;
      if (!w) throw new Error('reader_not_ready');
      const copy = minChannelInverted(source);
      const words = (res: { data: { words?: TessWord[] } }) =>
        (res.data.words ?? []).map((x) => ({ text: x.text, bbox: { x0: x.bbox.x0, y0: x.bbox.y0, x1: x.bbox.x1, y1: x.bbox.y1 } }));
      try {
        await w.setParameters({ thresholding_method: '0' });
        const first = words(await w.recognize(copy));
        await w.setParameters({ thresholding_method: '1' });
        const second = words(await w.recognize(source));
        return assignLines(mergeWordPasses(first, second));
      } finally {
        await w.setParameters({ thresholding_method: '0' }).catch(() => undefined);
        if (copy !== source) {
          copy.getContext('2d')?.clearRect(0, 0, copy.width, copy.height);
          copy.width = 0;
          copy.height = 0;
        }
      }
    },
    detectNames: (text) => findNames(text),
    async dispose() {
      const w = worker;
      worker = null;
      warming = null;
      if (w) await w.terminate();
    },
  };
}
