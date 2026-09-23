/**
 * Turns parsed files into the shapes the screen and the run loop want. Pure
 * functions, so the tests can reach them without a browser.
 */

import type { Connection } from './parse/connections';
import type { Invitation } from './parse/invitations';
import type { QuestionSpec, RowResult } from './spec/types';
import { stateFor } from './spec/compile';
import { tierFor, type ConnectionTier, type TierInput } from './tiers';
import type { Thresholds } from './spec/types';

export function initialsOf(first: string, last: string): string {
  const a = first.trim()[0] ?? '';
  const b = last.trim()[0] ?? '';
  return (a + b).toUpperCase() || '·';
}

export function fullName(first: string, last: string): string {
  return [first, last].filter(Boolean).join(' ').trim();
}

/** Only the contract fields the enabled questions asked for. */
export function connectionState(c: Connection, questions: QuestionSpec[]) {
  const fields = [...new Set(questions.filter((q) => q.enabled).flatMap((q) => q.fields))];
  return stateFor(
    {
      position: c.position,
      company: c.company,
      connected_for: c.connected_for,
      name_suffixes: c.name_suffixes,
    },
    fields,
  );
}

export function invitationState(i: Invitation, questions: QuestionSpec[]) {
  const fields = [...new Set(questions.filter((q) => q.enabled).flatMap((q) => q.fields))];
  return stateFor(
    { name: i.name, message: i.message, invitation_age: i.invitation_age },
    fields,
  );
}

export function tierOfConnection(
  presetId: string,
  c: Connection,
  result: RowResult | undefined,
  thresholds: Thresholds,
): ConnectionTier | undefined {
  if (!result || result.error) return undefined;
  const input: TierInput = { answers: result.answers, positionEmpty: c.position.trim() === '' };
  return tierFor(presetId, input, thresholds);
}

export function countBy<T>(items: T[], key: (t: T) => string | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const it of items) {
    const k = key(it);
    if (!k) continue;
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}
