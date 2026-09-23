/**
 * Editing a shipped preset forks it. The built-in stays in code, read-only and
 * always recoverable; your edits live in the browser under their own name.
 *
 * The alternative — mutating the shipped preset in place — means one bad edit
 * and there is nothing to reset to.
 */

import { validateQuestions, hasBlockingError, type SpecError } from '../spec/validate';
import type { Preset, QuestionSpec } from '../spec/types';
import { PRESETS } from './index';

export const FORK_SUFFIX = ' (edited)';

export function isBuiltIn(id: string): boolean {
  return PRESETS.some((p) => p.id === id);
}

/** A fresh, unused name for a fork of `base`. */
export function forkName(base: Preset, existing: Preset[]): { id: string; name: string } {
  let n = 1;
  let id = `${base.id}-edited`;
  let name = `${base.name}${FORK_SUFFIX}`;
  while (existing.some((p) => p.id === id)) {
    n += 1;
    id = `${base.id}-edited-${n}`;
    name = `${base.name}${FORK_SUFFIX} ${n}`;
  }
  return { id, name };
}

export function fork(base: Preset, existing: Preset[]): Preset {
  const { id, name } = forkName(base, existing);
  return {
    ...base,
    id,
    name,
    // Deep enough: questions and thresholds are what get edited.
    questions: base.questions.map((q) => structuredClone(q)),
    thresholds: { ...base.thresholds },
    sliders: base.sliders.map((s) => ({ ...s })),
  };
}

export function exportJson(p: Preset): string {
  return JSON.stringify(p, null, 2);
}

export type ImportResult =
  | { ok: true; preset: Preset }
  | { ok: false; message: string; errors?: SpecError[] };

/**
 * A pasted file is untrusted input and goes through the same validator the
 * scoring route uses. Anything weaker would let an imported preset name a
 * field the contract forbids, which is the one rule that cannot be optional.
 */
export function importJson(text: string, existing: Preset[]): ImportResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, message: 'That file is not valid JSON.' };
  }

  const p = raw as Partial<Preset>;
  if (!p || typeof p !== 'object' || !Array.isArray(p.questions)) {
    return { ok: false, message: 'That file does not look like a preset: no questions in it.' };
  }
  if (typeof p.name !== 'string' || !p.name.trim()) {
    return { ok: false, message: 'That preset has no name.' };
  }

  const errors = validateQuestions(p.questions as QuestionSpec[]);
  if (hasBlockingError(errors)) {
    return {
      ok: false,
      message: 'That preset has questions this app will not run.',
      errors: errors.filter((e) => e.severity === 'error'),
    };
  }

  // Never let an import silently replace a shipped preset.
  let id = (p.id ?? 'imported').toString();
  let name = p.name;
  if (isBuiltIn(id) || existing.some((e) => e.id === id)) {
    const next = forkName({ ...(p as Preset), id, name }, existing);
    id = next.id;
    name = `${name} (imported)`;
  }

  return {
    ok: true,
    preset: {
      id,
      name,
      purpose: p.purpose ?? '',
      icp: p.icp ?? '',
      questions: p.questions as QuestionSpec[],
      thresholds: p.thresholds ?? {},
      sliders: p.sliders ?? [],
    },
  };
}
