/**
 * Turns a validated spec into the SDK's own question objects, and normalizes
 * what comes back. Kept apart from the route so the shapes can be tested
 * without a network call.
 */

import { choice, noul, score, type JsonValue, type Questions } from '@typesafe-ai/sdk';
import type { Answer, QuestionSpec } from './types';

export function compile(questions: QuestionSpec[]): Questions {
  const out: Questions = {};
  for (const q of questions) {
    if (!q.enabled) continue;
    if (q.type === 'choice') {
      const criteria: Record<string, string> = {};
      for (const o of q.options) criteria[o.name] = o.criterion;
      out[q.id] = choice(q.instructions, criteria);
    } else if (q.type === 'score') {
      // The SDK types levels as a tuple of at least two; the validator has
      // already guaranteed that, so the cast is safe here and nowhere else.
      out[q.id] = score(q.instructions, q.levels as unknown as [string, string, ...string[]]);
    } else {
      const criteria =
        q.whenTrue || q.whenFalse
          ? { ...(q.whenTrue ? { true: q.whenTrue } : {}), ...(q.whenFalse ? { false: q.whenFalse } : {}) }
          : undefined;
      out[q.id] = noul(q.instructions, criteria);
    }
  }
  return out;
}

/** Keep the whole distribution: moving a threshold later must not cost a call. */
export function normalizeAnswer(raw: any): Answer {
  if (raw.type === 'choice') {
    return {
      type: 'choice',
      choice: raw.choice,
      confidence: raw.confidence,
      probabilities: { ...raw.probabilities },
    };
  }
  if (raw.type === 'score') {
    return {
      type: 'score',
      score: raw.score,
      confidence: raw.confidence,
      probabilities: { ...raw.probabilities },
    };
  }
  return { type: 'noul', noul: raw.noul };
}

/** Only the state fields a question declared. Nothing else leaves the browser. */
export function stateFor(
  row: Record<string, unknown>,
  fields: string[],
): Record<string, JsonValue> {
  const state: Record<string, JsonValue> = {};
  for (const f of fields) {
    const v = row[f];
    // Absent and empty fields are omitted rather than sent as "", so the model
    // sees "this was not provided" instead of "this is blank".
    if (v !== undefined && v !== null && v !== '') state[f] = v as JsonValue;
  }
  return state;
}

/** The union of every enabled question's fields, for one call per row. */
export function unionFields(questions: QuestionSpec[]): string[] {
  const s = new Set<string>();
  for (const q of questions) if (q.enabled) for (const f of q.fields) s.add(f);
  return [...s];
}
