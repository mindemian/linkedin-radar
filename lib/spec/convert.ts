/**
 * Converting a question between types is the one edit that destroys work.
 * Turning a Choice with nine described options into a yes/no throws away nine
 * criteria somebody wrote. So the discarded shape is kept on the question and
 * restored if you convert back.
 */

import type { QuestionSpec } from './types';

type Kept = {
  options?: { name: string; criterion: string }[];
  levels?: string[];
  whenTrue?: string;
  whenFalse?: string;
};

/** Stored on the spec, ignored by the hash and by the compiler. */
export type WithPrevious = QuestionSpec & { _previous?: Record<string, Kept> };

export function describeLoss(q: QuestionSpec, to: QuestionSpec['type']): string | null {
  if (q.type === to) return null;
  if (q.type === 'choice' && q.options.length > 2) {
    return `This will discard ${q.options.length} options and the criteria written for them.`;
  }
  if (q.type === 'score' && q.levels.length > 2) {
    return `This will discard ${q.levels.length} score levels.`;
  }
  if (q.type === 'noul' && (q.whenTrue || q.whenFalse)) {
    return 'This will discard the yes and no descriptions.';
  }
  return null;
}

export function convert(q: WithPrevious, to: QuestionSpec['type']): WithPrevious {
  if (q.type === to) return q;

  // Pull the shape out once, up front. Narrowing q inside each branch below
  // fights the compiler for no benefit, and the values are all we need.
  const options = q.type === 'choice' ? q.options : undefined;
  const levels = q.type === 'score' ? q.levels : undefined;
  const whenTrue = q.type === 'noul' ? q.whenTrue : undefined;
  const whenFalse = q.type === 'noul' ? q.whenFalse : undefined;

  // Remember what we are leaving behind, filed under the type we are leaving.
  const previous: Record<string, Kept> = { ...(q._previous ?? {}) };
  previous[q.type] =
    options ? { options } : levels ? { levels } : { whenTrue, whenFalse };

  const base = {
    id: q.id, tab: q.tab, enabled: q.enabled, fields: q.fields,
    instructions: q.instructions, _previous: previous,
  };
  const restored = previous[to];

  if (to === 'choice') {
    // A sensible starting point beats an empty form: carry across whatever the
    // old type had that reads like an option.
    const next =
      restored?.options ??
      (levels
        ? levels.map((l, i) => ({ name: `level_${i}`, criterion: l }))
        : [
            { name: 'yes', criterion: whenTrue ?? 'It is true.' },
            { name: 'no', criterion: whenFalse ?? 'It is false.' },
          ]);
    return { ...base, type: 'choice', options: next };
  }

  if (to === 'score') {
    const next =
      restored?.levels ??
      (options ? options.map((o) => o.criterion) : ['Clearly not.', 'Unclear.', 'Clearly so.']);
    return { ...base, type: 'score', levels: next.slice(0, 10) };
  }

  return {
    ...base,
    type: 'noul',
    whenTrue: restored?.whenTrue ?? options?.[0]?.criterion ?? levels?.at(-1),
    whenFalse: restored?.whenFalse ?? options?.at(-1)?.criterion ?? levels?.[0],
  };
}
