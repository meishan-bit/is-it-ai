import scenariosJson from '../../content/scenarios.json';
import glossaryJson from '../../content/glossary.json';
import tacticsJson from '../../content/tactics.json';
import metaJson from '../../content/meta.json';
import type { GlossaryTerm, Scenario, Tactic } from './types';

export const SCENARIOS = scenariosJson.scenarios as unknown as Scenario[];
export const GLOSSARY = glossaryJson.terms as unknown as GlossaryTerm[];
export const TACTICS = tacticsJson.tactics as unknown as Tactic[];
export const CONTENT_VERSION: string = metaJson.content_version;

export const PRACTICE_POOL = SCENARIOS.filter((s) => s.use === 'practice');

export function getScenario(id: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}
export function getTactic(id: string): Tactic | undefined {
  return TACTICS.find((t) => t.id === id);
}
/** Glossary "practise this" links may only point at practice items: test items never appear in practice. */
export function practiceItemsFor(term: GlossaryTerm): string[] {
  if (term.practice_items.includes('ALL')) return PRACTICE_POOL.map((s) => s.id);
  return term.practice_items.filter((id) => getScenario(id)?.use === 'practice');
}
