// Type declarations for image-pii-redactor 0.10.1, which ships without its own
// type files. Only the functions Check It uses. Checked against the package source.

declare module 'image-pii-redactor' {
  import type { LibraryEntity, OcrResult, Redaction } from '@/lib/redaction/types';

  type Progress = (event: { phase: string; progress: number; message: string }) => void;

  export function analyzeImage(
    image: HTMLImageElement | ImageBitmap | Blob,
    config: Record<string, unknown>,
    onProgress?: Progress,
  ): Promise<{ ocr: OcrResult; entities: LibraryEntity[]; redactions: Redaction[] }>;

  export function renderRedactedImage(
    image: HTMLImageElement | ImageBitmap,
    redactions: Redaction[],
  ): Promise<{ blob: Blob; width: number; height: number }>;

  export function runOcr(image: ImageBitmap | HTMLImageElement | Blob, lang?: string, onProgress?: Progress): Promise<OcrResult>;
  export function preloadNerModel(modelId: string, onProgress?: Progress): Promise<void>;
  export function releaseNerModel(): Promise<void>;
  export function registerServiceWorker(): Promise<unknown>;
}
