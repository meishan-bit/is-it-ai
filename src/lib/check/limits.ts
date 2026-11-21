export const DEFAULT_PER_ANON_PER_DAY = 10;
export const DEFAULT_GLOBAL_PER_DAY = 300;
export const DAY_MS = 24 * 60 * 60 * 1000;

export type LimitDecision = 'ok' | 'anon' | 'global';

/** counts are the checks in the last 24 hours. null means "could not count": the check goes ahead (and the error is logged by code). */
export function decideLimit(c: { perAnonCount: number | null; globalCount: number | null; perAnon: number; global: number }): LimitDecision {
  if (c.perAnonCount !== null && c.perAnonCount >= c.perAnon) return 'anon';
  if (c.globalCount !== null && c.globalCount >= c.global) return 'global';
  return 'ok';
}

/**
 * Counts in memory when no database is connected. Per server instance only, so it is a stopgap for previews:
 * with Supabase connected the counts come from check_events.
 */
export class MemoryCounter {
  private hits: Array<{ anon: string; at: number }> = [];
  add(anon: string, at: number): void {
    this.prune(at);
    this.hits.push({ anon, at });
  }
  count(since: number, anon?: string): number {
    return this.hits.filter((h) => h.at >= since && (anon === undefined || h.anon === anon)).length;
  }
  private prune(now: number): void {
    const cut = now - DAY_MS;
    this.hits = this.hits.filter((h) => h.at >= cut);
  }
}
