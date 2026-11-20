// Shared types for Check It redaction. These mirror the shapes used by the
// image-pii-redactor package (MPL-2.0), so our rules can feed its pipeline.

export interface BBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** A word found by OCR, with its place in the image and in the full text. */
export interface OcrWord {
  text: string;
  bbox: BBox;
  confidence: number;
  /** Inclusive start index in the full text. */
  charStart: number;
  /** Exclusive end index in the full text. */
  charEnd: number;
  lineIndex: number;
}

export interface OcrResult {
  fullText: string;
  words: OcrWord[];
  imageWidth: number;
  imageHeight: number;
}

/** Something one of our rules wants hidden: a character span in the OCR text. */
export interface CaMatch {
  rule: CaRuleId;
  /** Plain-language label for the review screen, e.g. "card number". */
  label: string;
  start: number;
  end: number;
  text: string;
}

/** A span the rules want kept visible (a link's domain, an email's domain). */
export interface KeepZone {
  start: number;
  end: number;
}

export type CaRuleId =
  | 'CA_SIN_OR_9_DIGIT_ID'
  | 'CA_POSTAL_CODE'
  | 'CA_HEALTH_NUMBER'
  | 'PHONE_NANP'
  | 'PAYMENT_CARD'
  | 'ONE_TIME_CODE_OR_PIN'
  | 'EMAIL_LOCAL_PART'
  | 'LINK_TRACKING'
  | 'DATE_OF_BIRTH';

/** A box to draw on the image. Matches image-pii-redactor's Redaction shape. */
export interface Redaction {
  id: string;
  bbox: BBox;
  source: 'auto' | 'manual';
  entityId?: string;
  enabled: boolean;
  label?: string;
}

/** An entity found by image-pii-redactor's name detector (NER) or compromise. */
export interface LibraryEntity {
  id: string;
  label: string;
  text: string;
  start: number;
  end: number;
  score: number;
  source: 'ner' | 'regex' | 'compromise';
}
