/**
 * Claude's standard image budget (from the Check It brief): at most 1568 px on the long edge and at most 1568 visual
 * tokens, where one token covers a 28 x 28 pixel patch. Shrinking on the phone sends less and keeps the text as sharp as
 * Claude would have kept it anyway.
 */
export const MAX_LONG_EDGE = 1568;
export const MAX_TOKENS = 1568;
export const PATCH = 28;

export const visualTokens = (w: number, h: number): number => Math.ceil(w / PATCH) * Math.ceil(h / PATCH);

export function fitToBudget(w: number, h: number, maxEdge: number = MAX_LONG_EDGE): { width: number; height: number } {
  let scale = Math.min(1, maxEdge / Math.max(w, h));
  let width = Math.max(1, Math.round(w * scale));
  let height = Math.max(1, Math.round(h * scale));
  while (visualTokens(width, height) > MAX_TOKENS && scale > 0.05) {
    scale *= 0.97;
    width = Math.max(1, Math.round(w * scale));
    height = Math.max(1, Math.round(h * scale));
  }
  return { width, height };
}
