import type { ClaudeContent } from './prompt';
import { CHECK_SCHEMA } from './prompt';
import type { ModelCall } from './handler';

/**
 * One call to the Claude Messages API using structured outputs (output_config.format, json_schema).
 * Claude Haiku 5.5 rejects sampling settings (temperature, top_p, top_k), so none are sent.
 * Adaptive thinking is on by default and its tokens count toward max_tokens, so the limit leaves room for it.
 */
export async function callClaude(args: {
  apiKey: string;
  model: string;
  maxTokens: number;
  system: string;
  content: ClaudeContent[];
  timeoutMs: number;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
}): Promise<ModelCall> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), args.timeoutMs);
  try {
    const res = await (args.fetchImpl ?? fetch)(`${args.baseUrl ?? 'https://api.anthropic.com'}/v1/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': args.apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: args.model,
        max_tokens: args.maxTokens,
        system: args.system,
        messages: [{ role: 'user', content: args.content }],
        output_config: { format: { type: 'json_schema', schema: CHECK_SCHEMA } },
      }),
      signal: ctl.signal,
      cache: 'no-store',
    });
    if (!res.ok) {
      // Only the status code is kept. The body can echo the request, so it is never read or logged.
      console.error('claude request failed', res.status);
      return { ok: false, kind: 'error' };
    }
    const data = (await res.json()) as { content?: Array<{ type?: string; text?: string }>; stop_reason?: string | null };
    const block = (data.content ?? []).find((b) => b.type === 'text' && typeof b.text === 'string');
    if (!block || typeof block.text !== 'string') return { ok: false, kind: 'error' };
    return { ok: true, text: block.text, stop: data.stop_reason ?? null };
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') return { ok: false, kind: 'timeout' };
    console.error('claude request error');
    return { ok: false, kind: 'error' };
  } finally {
    clearTimeout(timer);
  }
}
