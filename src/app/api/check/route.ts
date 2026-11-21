import { callClaude } from '@/lib/check/anthropic';
import { CHECK_CONTENT_LITE } from '@/lib/check/types-content';
import { handleCheck } from '@/lib/check/handler';
import { DEFAULT_GLOBAL_PER_DAY, DEFAULT_PER_ANON_PER_DAY, MemoryCounter } from '@/lib/check/limits';
import { checkStoreConfigured, countChecks, insertCheckEvent } from '@/lib/check/store';
import type { CheckEventRow, TacticLite } from '@/lib/check/types';
import { TACTICS } from '@/lib/content';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const memory = new MemoryCounter();
const intEnv = (name: string, fallback: number) => {
  const n = parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

/**
 * One POST: the phone sends a redacted picture, masked text, or call answers. The server checks it, asks Claude,
 * and returns a validated result. Nothing from the message is logged or stored; check_events keeps counts only.
 * Set up: ANTHROPIC_API_KEY (and the Supabase keys the app already uses) in Vercel, Production only. See docs/CHECK_IT.md.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const useDb = checkStoreConfigured();
  const tactics: TacticLite[] = TACTICS.map((t) => ({ id: t.id, name: t.name, red_flags: t.red_flags, safe_step: t.safe_step }));
  const out = await handleCheck(raw, {
    now: () => Date.now(),
    tactics,
    content: CHECK_CONTENT_LITE,
    model: process.env.CHECK_MODEL || 'claude-haiku-5-5',
    apiKey: process.env.ANTHROPIC_API_KEY || null,
    perAnon: intEnv('CHECK_DAILY_LIMIT', DEFAULT_PER_ANON_PER_DAY),
    global: intEnv('CHECK_GLOBAL_LIMIT', DEFAULT_GLOBAL_PER_DAY),
    countChecks: async ({ anonId, sinceIso }) => {
      if (!useDb) return memory.count(new Date(sinceIso).getTime(), anonId);
      try {
        return await countChecks({ anonId, sinceIso });
      } catch (e) {
        console.error('check count failed', e instanceof Error ? e.name : 'error');
        return null;
      }
    },
    recordEvent: async (row: CheckEventRow) => {
      if (row.outcome !== 'rate_limited') memory.add(row.anon_id, Date.now());
      if (!useDb) return;
      try {
        await insertCheckEvent(row);
      } catch (e) {
        // Codes only. The row holds no message content, but nothing else is printed either.
        console.error('check event failed', e instanceof Error ? e.name : 'error', (e as { code?: string }).code ?? '');
      }
    },
    callModel: ({ system, content }) =>
      callClaude({
        apiKey: process.env.ANTHROPIC_API_KEY ?? '',
        model: process.env.CHECK_MODEL || 'claude-haiku-5-5',
        // Thinking tokens count toward max_tokens on Claude Haiku 5.5, so the limit is 1024 rather than the brief's 400.
        maxTokens: intEnv('CHECK_MAX_TOKENS', 1024),
        system,
        content,
        timeoutMs: 25_000,
      }),
  });
  return Response.json(out.body, { status: out.status, headers: { 'Cache-Control': 'no-store' } });
}
