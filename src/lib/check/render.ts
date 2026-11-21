import type { Box } from './types';
import { MAX_LONG_EDGE, fitToBudget } from './fit';

/** Picture handling for Check It. Browser only. The original picture stays in a canvas in memory and is cleared on leaving. */

export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_SEND_BYTES = 2 * 1024 * 1024;
const OCR_EDGE = 2400;
const PAD = 4;

/**
 * Draws the picture onto a canvas with its rotation applied (phone photos carry a rotation flag), at a size the reader copes with.
 * Drawing to a canvas also drops the photo's location and device data: only pixels survive.
 */
export async function fileToCanvas(file: Blob): Promise<HTMLCanvasElement> {
  let bitmap: ImageBitmap | null = null;
  let img: HTMLImageElement | null = null;
  let url: string | null = null;
  let w: number;
  let h: number;
  try {
    if (typeof createImageBitmap === 'function') {
      try {
        bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
      } catch {
        bitmap = await createImageBitmap(file);
      }
      w = bitmap.width;
      h = bitmap.height;
    } else {
      url = URL.createObjectURL(file);
      img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = () => reject(new Error('image_unreadable'));
        i.src = url as string;
      });
      w = img.naturalWidth;
      h = img.naturalHeight;
    }
    if (!w || !h) throw new Error('image_unreadable');
    const scale = Math.min(1, OCR_EDGE / Math.max(w, h));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('image_unreadable');
    ctx.drawImage((bitmap ?? img) as CanvasImageSource, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    bitmap?.close();
    if (url) URL.revokeObjectURL(url);
  }
}

function paint(ctx: CanvasRenderingContext2D, boxes: Box[], scale = 1): void {
  ctx.fillStyle = '#000000';
  for (const b of boxes) {
    ctx.fillRect((b.x0 - PAD) * scale, (b.y0 - PAD) * scale, (b.x1 - b.x0 + PAD * 2) * scale, (b.y1 - b.y0 + PAD * 2) * scale);
  }
}

/** Redraws the preview: the picture with a black box over every hidden chip. Called on every tap. */
export function drawRedacted(target: HTMLCanvasElement, source: HTMLCanvasElement, boxes: Box[]): void {
  if (target.width !== source.width) target.width = source.width;
  if (target.height !== source.height) target.height = source.height;
  const ctx = target.getContext('2d');
  if (!ctx) return;
  ctx.drawImage(source, 0, 0);
  paint(ctx, boxes);
}

function toPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('png_failed'))), 'image/png'));
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(new Error('png_failed'));
    r.readAsDataURL(blob);
  });
}

/**
 * The only picture that is ever sent: a new PNG with the hidden boxes burned in, shrunk to Claude's image budget.
 * It is built from pixels, so the original file, its metadata and its location never leave the phone.
 */
export async function redactedPngBase64(source: HTMLCanvasElement, boxes: Box[]): Promise<string> {
  let edge = MAX_LONG_EDGE;
  for (let attempt = 0; attempt < 6; attempt++) {
    const { width, height } = fitToBudget(source.width, source.height, edge);
    const scale = width / source.width;
    const out = document.createElement('canvas');
    out.width = width;
    out.height = height;
    const ctx = out.getContext('2d');
    if (!ctx) throw new Error('png_failed');
    ctx.drawImage(source, 0, 0, out.width, out.height);
    paint(ctx, boxes, scale);
    const blob = await toPngBlob(out);
    out.width = 0;
    if (blob.size <= MAX_SEND_BYTES) return blobToBase64(blob);
    edge = Math.round(edge * 0.75);
  }
  throw new Error('png_too_large');
}

export function clearCanvas(c: HTMLCanvasElement | null | undefined): void {
  if (!c) return;
  const ctx = c.getContext('2d');
  ctx?.clearRect(0, 0, c.width, c.height);
  c.width = 0;
  c.height = 0;
}
