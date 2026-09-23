/**
 * One validator, three callers: the Studio runs it as you type, the build runs
 * it over the shipped defaults, and /api/score runs it on anything it receives.
 * Having a single implementation is the point — a rule the UI enforces but the
 * route does not is not a rule.
 */

import { forbiddenIn, isAllowed } from '../contract';
import type { QuestionSpec } from './types';

export type SpecError = {
  questionId: string;
  field?: string;
  message: string;
  severity: 'error' | 'warning';
};

/** The SDK's own limits. Choice takes 2 to 255 labels; Score takes 2 to 10 levels. */
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 255;
const MIN_LEVELS = 2;
const MAX_LEVELS = 10;

export function validateQuestion(
  q: QuestionSpec,
  /** Columns actually present in the current upload, when one is loaded. */
  availableFields?: readonly string[],
): SpecError[] {
  const errors: SpecError[] = [];
  const err = (message: string, field?: string) =>
    errors.push({ questionId: q.id, field, message, severity: 'error' });
  const warn = (message: string, field?: string) =>
    errors.push({ questionId: q.id, field, message, severity: 'warning' });

  if (!q.id.trim()) err('A question needs an id.');
  if (!q.instructions.trim()) err('Instructions cannot be empty.');

  // --- fields -------------------------------------------------------------
  if (q.fields.length === 0) {
    err('Select at least one field for this question to read.');
  }
  for (const f of q.fields) {
    if (forbiddenIn(q.tab, f)) {
      err(
        `"${f}" is not in a LinkedIn export, so asking about it before enrichment means guessing.`,
        f,
      );
    } else if (!isAllowed(q.tab, f)) {
      err(`"${f}" is outside the field contract for the ${q.tab} tab.`, f);
    } else if (availableFields && !availableFields.includes(f)) {
      warn(`"${f}" is not present in the file you uploaded.`, f);
    }
  }

  // --- shape --------------------------------------------------------------
  if (q.type === 'choice') {
    if (q.options.length < MIN_OPTIONS) err(`A choice needs at least ${MIN_OPTIONS} options.`);
    if (q.options.length > MAX_OPTIONS) err(`A choice takes at most ${MAX_OPTIONS} options.`);
    const seen = new Set<string>();
    for (const o of q.options) {
      if (!o.name.trim()) err('Every option needs a name.');
      if (!o.criterion.trim()) err(`Option "${o.name}" needs a criterion saying what belongs to it.`);
      if (seen.has(o.name)) err(`Two options are both named "${o.name}".`);
      seen.add(o.name);
    }
  } else if (q.type === 'score') {
    if (q.levels.length < MIN_LEVELS) err(`A score needs at least ${MIN_LEVELS} levels.`);
    if (q.levels.length > MAX_LEVELS) err(`A score takes at most ${MAX_LEVELS} levels.`);
    q.levels.forEach((l, i) => {
      if (!l.trim()) err(`Level ${i} is empty.`);
    });
  } else {
    // Noul takes a statement, and descriptions of the two outcomes at most.
    if (q.instructions.trim().length < 10) {
      warn('A yes/no statement this short is usually too vague to answer consistently.');
    }
  }

  // --- instructions that fight their own criteria -------------------------
  if (q.type === 'choice') {
    const named = q.options.map((o) => o.name.toLowerCase());
    const text = q.instructions.toLowerCase();
    // Quoted option names in the instructions that no option actually has.
    for (const quoted of q.instructions.match(/"([a-z0-9_]+)"/gi) ?? []) {
      const name = quoted.replace(/"/g, '').toLowerCase();
      if (name.includes('_') && !named.includes(name)) {
        warn(`The instructions mention "${name}", but there is no option by that name.`);
      }
    }
    const escapes = ['unknown', 'unclear', 'not_stated', 'other'];
    if (named.some((n) => escapes.includes(n)) && !escapes.some((e) => text.includes(e))) {
      warn('There is an escape option, but the instructions never say when to choose it.');
    }
  }

  return errors;
}

export function validateQuestions(
  questions: QuestionSpec[],
  availableFields?: readonly string[],
): SpecError[] {
  const errors = questions.flatMap((q) => validateQuestion(q, availableFields));
  const ids = new Set<string>();
  for (const q of questions) {
    if (ids.has(q.id)) {
      errors.push({ questionId: q.id, message: `Two questions share the id "${q.id}".`, severity: 'error' });
    }
    ids.add(q.id);
  }
  return errors;
}

export function hasBlockingError(errors: SpecError[]): boolean {
  return errors.some((e) => e.severity === 'error');
}
