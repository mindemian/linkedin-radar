'use client';

/**
 * Test on 25 rows, and re-run everything. Both live here because they are the
 * same act at two sizes, and because without them the Studio is a text editor:
 * you can change a question, you are told the stored answers no longer match
 * it, and there is nothing to click.
 *
 * The test run writes under a throwaway key so a trial never overwrites the
 * answers the main screen is showing.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { startRun, costOf, type RunHandle, type RunProgress } from '@/lib/run';
import { stateFor, unionFields } from '@/lib/spec/compile';
import { clearResults, type StoredRow } from '@/lib/store';
import type { Answer, Preset, RowResult } from '@/lib/spec/types';

const SAMPLE = 25;
const TEST_KEY = '__studio_test';

type Row = { row: StoredRow; before?: RowResult; after?: RowResult };

/** What an answer says, in one short string, for a before/after column. */
function describe(a: Answer | undefined): string {
  if (!a) return '—';
  if (a.type === 'choice') return `${a.choice} ${(a.confidence * 100).toFixed(0)}`;
  if (a.type === 'score') return `${a.score} ${(a.confidence * 100).toFixed(0)}`;
  return a.noul.toFixed(2);
}

/** A flip is a different pick, or a noul crossing the halfway line. */
function flipped(before: Answer | undefined, after: Answer | undefined): boolean {
  if (!before || !after || before.type !== after.type) return false;
  if (before.type === 'choice' && after.type === 'choice') return before.choice !== after.choice;
  if (before.type === 'score' && after.type === 'score') return before.score !== after.score;
  if (before.type === 'noul' && after.type === 'noul') return (before.noul >= 0.5) !== (after.noul >= 0.5);
  return false;
}

/** Deterministic sample, so two test runs of the same file compare like for like. */
function sample<T>(items: T[], n: number): T[] {
  if (items.length <= n) return items;
  const step = items.length / n;
  return Array.from({ length: n }, (_, i) => items[Math.floor(i * step)]);
}

export default function TestRun({
  draft, rows, results, fileKey, blocked, staleCount, onReplaceResults,
}: {
  draft: Preset;
  /** Contract fields of every parsed row of the active upload. */
  rows: StoredRow[];
  /** What is stored now, to compare a trial against. */
  results: Record<string, RowResult>;
  fileKey: string;
  blocked: boolean;
  staleCount: number;
  /** A full re-run replaces what the main screen shows. */
  onReplaceResults: (r: Record<string, RowResult>) => void;
}) {
  const [busy, setBusy] = useState<'test' | 'all' | null>(null);
  const [progress, setProgress] = useState<RunProgress | null>(null);
  const [trial, setTrial] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const handle = useRef<RunHandle | null>(null);

  const questions = useMemo(
    () => draft.questions.filter((q) => q.enabled && q.tab !== 'enriched'),
    [draft.questions],
  );
  const fields = useMemo(() => unionFields(questions), [questions]);

  const avgTokens = useMemo(() => {
    const scored = Object.values(results).filter((r) => r.inputTokens > 0);
    if (scored.length === 0) return 0;
    return scored.reduce((n, r) => n + r.inputTokens, 0) / scored.length;
  }, [results]);

  const estimate = (n: number) =>
    avgTokens > 0 ? `about $${costOf(avgTokens * n).toFixed(4)}` : 'an unknown amount, until one run has happened';

  const runOver = useCallback((
    picked: StoredRow[], key: string, kind: 'test' | 'all',
    onFinish: (out: Record<string, RowResult>) => void,
  ) => {
    setError(null);
    setBusy(kind);
    const collected: Record<string, RowResult> = {};
    handle.current = startRun({
      fileKey: key,
      rows: picked.map((r) => ({ rowId: r.rowId, state: stateFor(r.fields, fields) })),
      questions,
      onBatch: (batch, p) => {
        for (const r of batch) collected[r.rowId] = r;
        setProgress(p);
        onFinish({ ...collected });
      },
      onProgress: setProgress,
      onError: (m) => { setError(m); setBusy(null); },
      onDone: (p) => { setProgress(p); setBusy(null); onFinish({ ...collected }); },
    });
  }, [fields, questions]);

  const test = useCallback(async () => {
    const picked = sample(rows, SAMPLE);
    setTrial(picked.map((row) => ({ row, before: results[row.rowId] })));
    await clearResults(TEST_KEY);
    runOver(picked, TEST_KEY, 'test', (out) => {
      setTrial(picked.map((row) => ({ row, before: results[row.rowId], after: out[row.rowId] })));
    });
  }, [rows, results, runOver]);

  const rerun = useCallback(async () => {
    await clearResults(fileKey);
    onReplaceResults({});
    runOver(rows, fileKey, 'all', onReplaceResults);
  }, [rows, fileKey, runOver, onReplaceResults]);

  const flips = trial?.filter((t) => Object.keys(t.after?.answers ?? {}).some(
    (id) => flipped(t.before?.answers[id], t.after?.answers[id]),
  )).length ?? 0;

  if (rows.length === 0) {
    return (
      <p className="mt-3 text-xs" style={{ color: 'var(--muted)' }}>
        Load a file on the main screen and these buttons can test your edits against it.
      </p>
    );
  }

  return (
    <div className="mt-4" data-testid="test-run">
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={test}
          disabled={blocked || busy !== null}
          className="panel px-3 py-1.5 text-xs disabled:opacity-40"
        >
          {busy === 'test' ? 'Testing…' : `Test on ${Math.min(SAMPLE, rows.length)} rows`}
        </button>
        <button
          onClick={rerun}
          disabled={blocked || busy !== null}
          className="px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
          style={{ background: 'var(--accent)', color: '#fff' }}
          data-testid="rerun-all"
        >
          {busy === 'all' ? 'Re-running…' : `Re-run all ${rows.length.toLocaleString()} rows`}
        </button>
        {busy && (
          <button onClick={() => { handle.current?.cancel(); setBusy(null); }} className="text-xs underline">
            Stop
          </button>
        )}
        <span className="text-xs" style={{ color: 'var(--muted)' }}>
          Test costs {estimate(Math.min(SAMPLE, rows.length))}; the full re-run {estimate(rows.length)}.
          {staleCount > 0 && ` ${staleCount.toLocaleString()} rows are out of date.`}
        </span>
      </div>

      {blocked && (
        <p className="mt-2 text-xs" style={{ color: 'var(--accent)' }}>
          Fix the errors below first. A spec that fails here would be refused by the scoring
          service too, so neither button will fire.
        </p>
      )}

      {busy && progress && (
        <p className="mt-2 text-xs tabular-nums" style={{ color: 'var(--muted)' }}>
          {progress.rowsRead.toLocaleString()} of {progress.totalRows.toLocaleString()} rows ·
          ${progress.costUsd.toFixed(4)} so far
        </p>
      )}

      {error && <p className="mt-2 text-xs" style={{ color: 'var(--accent)' }}>{error}</p>}

      {trial && (
        <div className="panel mt-4 overflow-x-auto" data-testid="trial-table">
          <p className="px-3 pt-3 text-xs" style={{ color: 'var(--muted)' }}>
            {flips} of {trial.length} rows answered differently under the edited questions.
            Nothing here was saved.
          </p>
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase" style={{ color: 'var(--muted)' }}>
              <tr>
                <th className="px-3 py-2">Row</th>
                <th className="px-3 py-2">Question</th>
                <th className="px-3 py-2">Was</th>
                <th className="px-3 py-2">Now</th>
              </tr>
            </thead>
            <tbody>
              {trial.flatMap(({ row, before, after }) =>
                questions.map((q) => {
                  const b = before?.answers[q.id];
                  const a = after?.answers[q.id];
                  const changed = flipped(b, a);
                  return (
                    <tr key={`${row.rowId}-${q.id}`} className="border-t rule">
                      <td className="px-3 py-1 text-xs" style={{ color: 'var(--muted)' }}>
                        {row.fields.position || row.fields.name || row.rowId}
                      </td>
                      <td className="px-3 py-1 text-xs">{q.id}</td>
                      <td className="px-3 py-1 text-xs">{describe(b)}</td>
                      <td className="px-3 py-1 text-xs" style={changed ? { color: 'var(--accent)', fontWeight: 600 } : {}}>
                        {describe(a)}{changed ? ' ←' : ''}
                      </td>
                    </tr>
                  );
                }),
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
