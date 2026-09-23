'use client';

/**
 * The run driver. Slices rows into batches, posts each to /api/score, and
 * reports after every batch so the grid fills in visibly instead of freezing
 * and then finishing all at once.
 *
 * Each batch is written to IndexedDB as it lands, so closing the tab mid-run
 * costs one batch rather than the whole run.
 */

import { saveResults } from './store';
import type { QuestionSpec, RowResult } from './spec/types';

/** Small enough that a batch finishes well inside the route's 60s ceiling. */
export const BATCH_SIZE = 25;

/** $0.042 per million input tokens. */
export const USD_PER_MILLION_INPUT_TOKENS = 0.042;

export type RunRow = { rowId: string; state: Record<string, unknown> };

export type RunProgress = {
  rowsRead: number;
  totalRows: number;
  typedAnswers: number;
  inputTokens: number;
  elapsedMs: number;
  costUsd: number;
  answersPerSecond: number;
  model: string;
  /** The row being scored right now, for the verifying panel. */
  currentRowId?: string;
};

export type RunHandle = {
  pause: () => void;
  resume: () => void;
  cancel: () => void;
  isPaused: () => boolean;
};

export function costOf(inputTokens: number): number {
  return (inputTokens / 1_000_000) * USD_PER_MILLION_INPUT_TOKENS;
}

type RunOptions = {
  fileKey: string;
  rows: RunRow[];
  questions: QuestionSpec[];
  /** Rows already scored, so a resumed run skips them. */
  alreadyScored?: Set<string>;
  onBatch: (results: RowResult[], progress: RunProgress) => void;
  onProgress?: (progress: RunProgress) => void;
  onError: (message: string) => void;
  onDone: (progress: RunProgress) => void;
};

export function startRun(opts: RunOptions): RunHandle {
  const { fileKey, questions, alreadyScored, onBatch, onProgress, onError, onDone } = opts;
  const pending = opts.rows.filter((r) => !alreadyScored?.has(r.rowId));

  const controller = new AbortController();
  let paused = false;
  let cancelled = false;

  const questionsPerRow = questions.filter((q) => q.enabled).length;
  const started = Date.now();
  let rowsRead = 0;
  let inputTokens = 0;
  let model = '';

  const progress = (currentRowId?: string): RunProgress => {
    const elapsedMs = Date.now() - started;
    const typedAnswers = rowsRead * questionsPerRow;
    return {
      rowsRead,
      totalRows: pending.length,
      typedAnswers,
      inputTokens,
      elapsedMs,
      costUsd: costOf(inputTokens),
      answersPerSecond: elapsedMs > 0 ? typedAnswers / (elapsedMs / 1000) : 0,
      model,
      currentRowId,
    };
  };

  const waitWhilePaused = async () => {
    while (paused && !cancelled) await new Promise((r) => setTimeout(r, 120));
  };

  (async () => {
    try {
      for (let i = 0; i < pending.length; i += BATCH_SIZE) {
        await waitWhilePaused();
        if (cancelled) return;

        const batch = pending.slice(i, i + BATCH_SIZE);
        onProgress?.(progress(batch[0]?.rowId));

        const response = await fetch('/api/score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: batch, questions }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          onError(body.error ?? `The scoring service returned an error (${response.status}).`);
          return;
        }

        const data: { results: RowResult[]; inputTokens: number; model: string } =
          await response.json();

        rowsRead += batch.length;
        inputTokens += data.inputTokens;
        if (data.model) model = data.model;

        // Persist before repainting: a crash between the two should lose the
        // pixels, not the answers.
        await saveResults(fileKey, data.results);
        onBatch(data.results, progress());

        // Yield to the browser so the grid actually repaints between batches.
        await new Promise((r) => setTimeout(r, 0));
      }
      onDone(progress());
    } catch (err) {
      if (controller.signal.aborted) return;
      onError(err instanceof Error ? err.message : 'Something went wrong during the run.');
    }
  })();

  return {
    pause: () => { paused = true; },
    resume: () => { paused = false; },
    cancel: () => { cancelled = true; controller.abort(); },
    isPaused: () => paused,
  };
}
