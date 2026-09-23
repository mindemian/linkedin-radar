import 'server-only';
import { NextResponse } from 'next/server';
import { hasKey, scoreRow, withConcurrency } from '@/lib/jev';
import { hasBlockingError, validateQuestions } from '@/lib/spec/validate';
import type { QuestionSpec } from '@/lib/spec/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** The hard cap. The browser sends 25 by default so a batch finishes well inside
 *  maxDuration even when every row is slow. */
const MAX_ROWS = 50;
const CONCURRENCY = 8;

type Body = {
  rows: { rowId: string; state: Record<string, unknown> }[];
  questions: QuestionSpec[];
};

export async function POST(request: Request) {
  if (!hasKey()) {
    return NextResponse.json(
      { error: 'No TypeSafe API key is configured on this deployment. Set TYPESAFE_API_KEY.' },
      { status: 500 },
    );
  }

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Could not read the request.' }, { status: 400 });
  }

  const rows = body.rows ?? [];
  const questions = body.questions ?? [];

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'No rows in the request.' }, { status: 400 });
  }
  if (rows.length > MAX_ROWS) {
    return NextResponse.json({ error: `Send at most ${MAX_ROWS} rows per request.` }, { status: 400 });
  }

  // The route is the authority on the spec, not the UI. A spec naming a field
  // outside the contract is refused here even if the Studio somehow allowed it.
  const errors = validateQuestions(questions);
  if (hasBlockingError(errors)) {
    return NextResponse.json(
      { error: 'The question spec is not valid.', details: errors.filter((e) => e.severity === 'error') },
      { status: 400 },
    );
  }
  if (questions.filter((q) => q.enabled).length === 0) {
    return NextResponse.json({ error: 'Every question is disabled.' }, { status: 400 });
  }

  const results = await withConcurrency(rows, CONCURRENCY, (r) =>
    scoreRow(r.rowId, r.state, questions, request.signal),
  );

  return NextResponse.json({
    results,
    inputTokens: results.reduce((n, r) => n + r.inputTokens, 0),
    model: results.find((r) => r.model)?.model ?? '',
  });
}
