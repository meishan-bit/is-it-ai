import type { Box, OcrWord, Span } from './types';

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

type TessWorker = {
  recognize(image: unknown): Promise<{ data: { words?: Array<{ text: string; bbox: Box }> } }>;
  terminate(): Promise<unknown>;
};
type TessModule = {
  createWorker: (lang: string, oem?: number, options?: { logger?: (m: { status: string; progress: number }) => void }) => Promise<TessWorker>;
};

/**
 * Built-in reader: Tesseract.js (OCR) in the browser. It finds the words and their boxes; the Canadian rules in
 * ca-patterns.ts decide which to hide. It has no name finder, so names are caught by the rules' cues and by the review.
 * The language data downloads once from a public CDN (nothing about the picture is sent there).
 */
function createTesseractEngine(): PhotoEngine {
  let worker: TessWorker | null = null;
  return {
    isReady: () => worker !== null,
    async warmUp(onProgress) {
      if (worker) return;
      const mod = (await import('tesseract.js')) as unknown as TessModule;
      worker = await mod.createWorker('eng', 1, {
        logger: (m) => onProgress?.({ stage: plainStage(m.status), percent: Number.isFinite(m.progress) ? Math.round(m.progress * 100) : null }),
      });
      onProgress?.({ stage: 'Ready', percent: 100 });
    },
    async recognize(source) {
      if (!worker) throw new Error('reader_not_ready');
      const res = await worker.recognize(source);
      return assignLines((res.data.words ?? []).map((w) => ({ text: w.text, bbox: { x0: w.bbox.x0, y0: w.bbox.y0, x1: w.bbox.x1, y1: w.bbox.y1 } })));
    },
    async dispose() {
      const w = worker;
      worker = null;
      warming = null;
      if (w) await w.terminate();
    },
  };
}
