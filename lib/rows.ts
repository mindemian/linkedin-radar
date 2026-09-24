/**
 * Turns parsed files into the shapes the screen and the run loop want. Pure
 * functions, so the tests can reach them without a browser.
 */

import type { Connection } from './parse/connections';
import type { Invitation } from './parse/invitations';
import type { QuestionSpec, RowResult } from './spec/types';
import { stateFor, unionFields } from './spec/compile';
import { bucketFor, tierFor, type ConnectionTier, type InvitationBucket, type TierInput } from './tiers';
import type { Thresholds } from './spec/types';

export function initialsOf(first: string, last: string): string {
  const a = first.trim()[0] ?? '';
  const b = last.trim()[0] ?? '';
  return (a + b).toUpperCase() || '·';
}

export function fullName(first: string, last: string): string {
  return [first, last].filter(Boolean).join(' ').trim();
}

/**
 * Every contract field of a row, unfiltered. One definition, used both for what
 * gets stored for a later re-run and for what a question may ask about, so the
 * two cannot drift.
 */
export function connectionFields(c: Connection): Record<string, string> {
  return {
    position: c.position,
    company: c.company,
    connected_for: c.connected_for,
    name_suffixes: c.name_suffixes ?? '',
  };
}

export function invitationFields(i: Invitation): Record<string, string> {
  return { name: i.name, message: i.message, invitation_age: i.invitation_age };
}

/** Only the contract fields the enabled questions asked for. */
export function connectionState(c: Connection, questions: QuestionSpec[]) {
  const fields = unionFields(questions);
  return stateFor(connectionFields(c), fields);
}

export function invitationState(i: Invitation, questions: QuestionSpec[]) {
  const fields = unionFields(questions);
  return stateFor(invitationFields(i), fields);
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

/**
 * An invitation's bucket. A row with no message never had a Jev call, so it
 * lands in "no signal" by the same rule the run loop uses to skip it.
 */
export function bucketOfInvitation(
  presetId: string,
  i: Invitation,
  result: RowResult | undefined,
  thresholds: Thresholds,
): InvitationBucket {
  const hasMessage = i.message.trim() !== '';
  if (!hasMessage) return 'no_signal';
  if (!result || result.error) return 'review';
  return bucketFor(presetId, result.answers, true, thresholds);
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
