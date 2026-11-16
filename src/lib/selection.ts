import type { Scenario } from './types';
import { shuffle } from './rng';

/**
 * Picks one practice round. Unseen examples come first so people get new ones each time,
 * and a round always contains at least one genuine message when the pool has any,
 * so the answer is not always "scam".
 */
export function pickPracticeRound(
  pool: readonly Scenario[],
  seen: readonly string[],
  rand: () => number = Math.random,
  size = 5,
): { items: Scenario[]; seen: string[] } {
  const eligible = pool.filter((s) => s.use === 'practice');
  const n = Math.min(size, eligible.length);
  const unseen = eligible.filter((s) => !seen.includes(s.id));
  const seenItems = eligible.filter((s) => seen.includes(s.id));
  let pick = [...shuffle(unseen, rand), ...shuffle(seenItems, rand)].slice(0, n);

  const hasReal = pick.some((s) => s.verdict === 'real');
  const realPool = eligible.filter((s) => s.verdict === 'real' && !pick.includes(s));
  if (!hasReal && realPool.length > 0 && n > 1) {
    const swapIn = shuffle(realPool, rand)[0];
    const swapOutIndex = pick.map((s) => s.verdict).lastIndexOf('scam');
    if (swapOutIndex >= 0) pick = pick.map((s, i) => (i === swapOutIndex ? swapIn : s));
  }
  pick = shuffle(pick, rand);

  let nextSeen = Array.from(new Set([...seen, ...pick.map((s) => s.id)]));
  if (eligible.every((s) => nextSeen.includes(s.id))) nextSeen = [];
  return { items: pick, seen: nextSeen };
}
