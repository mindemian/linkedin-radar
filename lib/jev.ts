/**
 * The only place that talks to Jev. Server-side only: the key never reaches
 * the browser.
 *
 * Retries on 429 and 529 are the SDK's own job. Its default RetryPolicy already
 * retries 408, 429 and 500-599 with exponential backoff and honours Retry-After,
 * so configuring that policy is the whole of it. A second hand-written loop on
 * top would fight the first and turn one rate-limit into a thundering herd.
 */

import { TypeSafeClient } from '@typesafe-ai/sdk';
import { compile, normalizeAnswer, stateFor } from './spec/compile';
import { hashAll } from './spec/hash';
import type { Answer, QuestionSpec } from './spec/types';

if (typeof window !== 'undefined') {
  throw new Error('lib/jev.ts must never be imported into client-side code.');
}

export const JEV_MODEL = 'jev-latest';

/**
 * People paste keys straight out of a dashboard, which often brings a stray
 * "API key:" label, quotes or a newline with it. Strip those rather than
 * failing later with an unexplained 401.
 */
function readKey(name: string): string | undefined {
  const raw = process.env[name];
  if (!raw) return undefined;
  const cleaned = raw
    .trim()
    .replace(/^(api[ _-]?key|token|secret)\s*[:=]\s*/i, '')
    .replace(/^["']|["']$/g, '')
    .trim();
  return cleaned || undefined;
}

export function hasKey(): boolean {
  return readKey('TYPESAFE_API_KEY') !== undefined;
}

let client: TypeSafeClient | undefined;

function jevClient(): TypeSafeClient {
  client ??= new TypeSafeClient({
    apiKey: readKey('TYPESAFE_API_KEY'),
    defaultModel: JEV_MODEL,
    timeout: 30_000,
    retry: {
      maxRetries: 4,
      backoffInitialMs: 500,
      backoffMaxMs: 8_000,
      respectRetryAfter: true,
    },
  });
  return client;
}

export type ScoredRow = {
  rowId: string;
  answers: Record<string, Answer>;
  questionHashes: Record<string, string>;
  latencyMs: number;
  inputTokens: number;
  model: string;
  error?: string;
};

/** One request per row, carrying every enabled question for that row. */
export async function scoreRow(
  rowId: string,
  row: Record<string, unknown>,
  questions: QuestionSpec[],
  signal?: AbortSignal,
): Promise<ScoredRow> {
  const started = Date.now();
  const enabled = questions.filter((q) => q.enabled);
  const fields = [...new Set(enabled.flatMap((q) => q.fields))];

  try {
    const result = await jevClient().systemOne(
      { state: stateFor(row, fields), questions: compile(enabled) },
      { signal },
    );
    const answers: Record<string, Answer> = {};
    for (const [id, raw] of Object.entries(result.answers)) {
      answers[id] = normalizeAnswer(raw);
    }
    return {
      rowId,
      answers,
      questionHashes: hashAll(enabled),
      latencyMs: Date.now() - started,
      inputTokens: result.usage.input_tokens,
      model: result.model,
    };
  } catch (err) {
    // Record that this row failed, never what was in it.
    return {
      rowId,
      answers: {},
      questionHashes: {},
      latencyMs: Date.now() - started,
      inputTokens: 0,
      model: '',
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/** Run with at most `limit` in flight. Results keep the input's order. */
export async function withConcurrency<T, R>(
  items: T[],
  limit: number,
  run: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await run(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}
