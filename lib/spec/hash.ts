/**
 * A content hash per question, so the app can tell whether an answer it stored
 * still answers the question being asked.
 *
 * This exists because of one specific way the Studio could mislead. Four
 * hundred rows get scored. You then reword a question. Every tier count on
 * screen is now derived from answers to a question that no longer exists — and
 * nothing says so. You would tune thresholds against stale numbers and never
 * find out. Hashing the question and storing the hash with the answer is what
 * makes that visible.
 *
 * Only what changes an answer's meaning goes into the hash. Enabling,
 * disabling or reordering a question does not change what it asks, so those
 * are deliberately excluded: a spurious "stale" warning teaches people to
 * ignore the warning.
 */

import type { QuestionSpec } from './types';

/** FNV-1a. Not cryptographic, and does not need to be — it detects edits, not attacks. */
function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** The meaning-bearing shape of a question, in a stable order. */
function meaningOf(q: QuestionSpec): string {
  const parts: string[] = [q.id, q.type, q.instructions.trim(), [...q.fields].sort().join(',')];
  if (q.type === 'choice') {
    for (const o of q.options) parts.push(`o:${o.name}=${o.criterion.trim()}`);
  } else if (q.type === 'score') {
    q.levels.forEach((l, i) => parts.push(`l${i}:${l.trim()}`));
  } else {
    parts.push(`t:${(q.whenTrue ?? '').trim()}`, `f:${(q.whenFalse ?? '').trim()}`);
  }
  return parts.join('␟');
}

export function questionHash(q: QuestionSpec): string {
  return fnv1a(meaningOf(q));
}

export function hashAll(questions: QuestionSpec[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const q of questions) out[q.id] = questionHash(q);
  return out;
}

export type Staleness = {
  /** Question id -> how many stored rows answered an older version of it. */
  byQuestion: Record<string, number>;
  /** Rows stale on at least one question. */
  staleRows: number;
  totalRows: number;
};

/**
 * A row counts as stale for a question when it stored a different hash for it.
 * A row that never answered the question at all is not stale — it is simply
 * unscored, which the run loop already handles.
 */
export function staleness(
  results: Record<string, { questionHashes?: Record<string, string> }>,
  questions: QuestionSpec[],
): Staleness {
  const live = hashAll(questions.filter((q) => q.enabled));
  const byQuestion: Record<string, number> = {};
  let staleRows = 0;
  const rows = Object.values(results);

  for (const r of rows) {
    let rowStale = false;
    for (const [id, hash] of Object.entries(live)) {
      const stored = r.questionHashes?.[id];
      if (stored !== undefined && stored !== hash) {
        byQuestion[id] = (byQuestion[id] ?? 0) + 1;
        rowStale = true;
      }
    }
    if (rowStale) staleRows += 1;
  }

  return { byQuestion, staleRows, totalRows: rows.length };
}

/** Plain English, because this warning is the whole point of the mechanism. */
export function describeStaleness(s: Staleness): string | null {
  const ids = Object.keys(s.byQuestion);
  if (ids.length === 0) return null;
  const worst = ids.sort((a, b) => s.byQuestion[b] - s.byQuestion[a])[0];
  const n = s.byQuestion[worst];
  const others = ids.length - 1;
  return (
    `${n.toLocaleString()} of ${s.totalRows.toLocaleString()} rows were scored with an ` +
    `earlier version of "${worst.replace(/_/g, ' ')}"` +
    (others > 0 ? `, and ${others} other question${others === 1 ? '' : 's'} changed too` : '') +
    `. The counts below still come from the old answers. Re-run to make them true.`
  );
}
