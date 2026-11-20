// Check It: redact a screenshot on the person's phone, before anything is sent.
// Browser only. Wraps image-pii-redactor (MPL-2.0, used unmodified) for reading
// the image and finding names and addresses; our Canadian rules do the rest.

import { findCanadianPii } from './ca-patterns';
import { filterLibraryEntities, houseNumberBefore, spanToBoxes, toRedactions } from './boxes';
import type { OcrResult, Redaction } from './types';

export const NER_MODEL = 'onnx-community/multilang-pii-ner-ONNX';

/**
 * Pass every option: analyzeImage() does not fill in defaults, so a missing
 * option is treated as "off" (that would silently switch off name detection).
 * useRegex is off: its built-in patterns are US-only and hide whole links and dates.
 */
export const REDACTOR_CONFIG = {
  lang: 'eng',
  nerModel: NER_MODEL,
  maxFileSize: 20 * 1024 * 1024,
  acceptedTypes: ['image/png', 'image/jpeg', 'image/webp'],
  minConfidence: 0.7,
  useRegex: false,
  useCompromise: true,
  detectAvatars: true,
  memoryMode: 'auto',
} as const;

export type ProgressEvent = { phase: string; progress: number; message: string };

const loadLibrary = () => import('image-pii-redactor');

/**
 * Download and prepare the reading and detection models ahead of time.
 * The first load took just over 3 minutes on an Android phone (Nov 20, 2026 test),
 * so call this when the Check It intro screen opens, not when the person taps "Check".
 * Later visits use the browser's cached copy.
 */
export async function warmUpRedactor(onProgress?: (e: ProgressEvent) => void): Promise<void> {
  const lib = await loadLibrary();
  const ner = lib.preloadNerModel(NER_MODEL, onProgress);
  // Reading a tiny blank image makes the OCR engine fetch its English data now.
  const ocr = (async () => {
    if (typeof OffscreenCanvas === 'undefined') return;
    const canvas = new OffscreenCanvas(32, 16);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, 32, 16);
    await lib.runOcr(await canvas.convertToBlob(), REDACTOR_CONFIG.lang);
  })();
  await Promise.all([ner, ocr]);
}

export interface ScreenshotAnalysis {
  /** Boxes for the review screen. Each can be switched off or added to by the person. */
  boxes: Redaction[];
  /** How many of each kind were hidden, for the check_events log (counts only, never values). */
  counts: Record<string, number>;
  ocr: OcrResult;
}

/** Read the screenshot and propose boxes. Nothing leaves the phone. */
export async function analyzeScreenshot(
  image: Blob,
  onProgress?: (e: ProgressEvent) => void,
): Promise<ScreenshotAnalysis> {
  const lib = await loadLibrary();
  const result = await lib.analyzeImage(image, REDACTOR_CONFIG, onProgress);
  const { ocr } = result;
  const size = { imageWidth: ocr.imageWidth, imageHeight: ocr.imageHeight };
  const counts: Record<string, number> = {};
  const count = (label: string) => (counts[label] = (counts[label] ?? 0) + 1);

  // 1. Our Canadian rules.
  const { matches, keep } = findCanadianPii(ocr.fullText);
  const boxes: Redaction[] = [];
  matches.forEach((m, i) => {
    boxes.push(...toRedactions(spanToBoxes(ocr.words, m.start, m.end, size), `ca-${i}`, m.label));
    count(m.label);
  });

  // 2. The library's names and addresses, minus its known mistakes.
  const kept = filterLibraryEntities(result.entities, ocr, keep);
  const keptIds = new Set(kept.map((e) => e.id));
  for (const r of result.redactions) {
    // Boxes without an entity are contact photos found next to a name: keep them.
    if (!r.entityId || keptIds.has(r.entityId)) boxes.push(r);
  }
  for (const e of kept) {
    count(e.label === 'STREET' || e.label === 'BUILDINGNUM' || e.label === 'CITY' ? 'address' : 'name');
    // The detector often boxes "Willow Crescent" but not the "142" before it.
    if (e.label === 'STREET') {
      const num = houseNumberBefore(ocr.words, e.start);
      if (num) boxes.push(...toRedactions(spanToBoxes(ocr.words, num.charStart, num.charEnd, size), `house-${e.id}`, 'address'));
    }
  }

  return { boxes, counts, ocr };
}

/** Draw the enabled boxes and return the redacted PNG. Re-encoding drops photo metadata (location, device). */
export async function renderRedacted(image: Blob, boxes: Redaction[]): Promise<Blob> {
  const lib = await loadLibrary();
  const bitmap = await createImageBitmap(image);
  try {
    const { blob } = await lib.renderRedactedImage(bitmap, boxes);
    return blob;
  } finally {
    bitmap.close();
  }
}
