import type { Form, Scenario, Stage } from './types';
import { seededShuffle } from './rng';

/** "t3", " T 3 " and "T03" all become { code: "T3", n: 3 }. Anything else is rejected. */
export function parseTestCode(raw: string): { code: string; n: number } | null {
  const m = /^t\s*-?\s*0*(\d{1,3})$/i.exec(raw.trim());
  if (!m) return null;
  const n = parseInt(m[1], 10);
  if (n < 1) return null;
  return { code: `T${n}`, n };
}

/** Odd codes take Form A first, even codes take Form B first (Week 1 test design). */
export function formOrder(n: number): [Form, Form] {
  return n % 2 === 1 ? ['A', 'B'] : ['B', 'A'];
}

export function formForStage(order: [Form, Form], stage: 'pre' | 'post'): Form {
  return stage === 'pre' ? order[0] : order[1];
}

export function nextStageAfter(stage: Stage): Stage {
  if (stage === 'pre') return 'practice';
  if (stage === 'practice') return 'post';
  return 'done';
}

/** The five items of a form, in a repeatable order for this tester. */
export function itemsForForm(scenarios: readonly Scenario[], form: Form, code: string): Scenario[] {
  const items = scenarios.filter((s) => s.form === form && s.use !== 'practice');
  return seededShuffle(items, `${code}:${form}`);
}
