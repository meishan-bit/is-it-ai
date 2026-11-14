export type Verdict = 'scam' | 'real';
export type Use = 'practice' | 'pre' | 'post';
export type Mode = Use;
export type Form = 'A' | 'B';
export type Stage = 'pre' | 'practice' | 'post' | 'done';

export interface Option {
  id: string;
  text: string;
  correct: boolean;
}
export interface Question {
  prompt: string;
  options: Option[];
}

export interface Scenario {
  id: string;
  use: Use;
  pair_id: string | null;
  form: Form | null;
  tactic: string;
  format: 'text' | 'text_image' | 'image' | 'audio';
  verdict: Verdict;
  sender_label: string;
  message: string[];
  media_id: string | null;
  media_kind: 'image' | 'audio' | null;
  media_url: string | null;
  alt_text: string | null;
  transcript: string | null;
  caption: string | null;
  ai_generated: boolean;
  highlights: string[];
  sign_question: Question;
  step_question: Question;
  explanation: string;
  source_labels: string[];
  source_urls: string[];
  notes?: string;
  media_orientation?: 'portrait';
}

export interface GlossaryTerm {
  slug: string;
  term: string;
  definition: string;
  example: string;
  example_sources: { label: string; url: string }[];
  what_to_do: string;
  practice_items: string[];
}

export interface Tactic {
  id: string;
  name: string;
  arrives_by: string;
  red_flags: string[];
  safe_step: string;
  source_labels: string[];
  source_urls: string[];
}

export interface ResponseRecord {
  scenario_id: string;
  verdict_choice: Verdict;
  verdict_correct: boolean;
  sign_choice: string;
  sign_correct: boolean;
  step_choice: string;
  step_correct: boolean;
  time_ms: number;
  answered_at: string;
}

export interface AttemptRecord {
  attempt_id: string;
  anon_id: string;
  mode: Mode;
  form: Form | null;
  started_at: string;
  completed_at: string | null;
  app_version: string;
  content_version: string;
  responses: ResponseRecord[];
}

export interface TestSession {
  code: string;
  order: [Form, Form];
  stage: Stage;
  age_band: string | null;
  pre_attempt_id: string | null;
  post_attempt_id: string | null;
  started_at: string;
}
