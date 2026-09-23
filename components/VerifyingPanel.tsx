'use client';

import Link from 'next/link';
import type { Answer, QuestionSpec, RowResult } from '@/lib/spec/types';
import { TIER_LABELS, type ConnectionTier } from '@/lib/tiers';

export type PanelRow = {
  rowId: string;
  name: string;
  position: string;
  company: string;
  connectedFor?: string;
  url?: string;
  tier?: ConnectionTier;
};

/** The number a bar should show: confidence for a pick, the probability for a yes/no. */
function magnitude(a: Answer): number {
  if (a.type === 'noul') return a.noul;
  return a.confidence;
}

function readable(a: Answer, q: QuestionSpec | undefined): string {
  if (a.type === 'choice') return a.choice;
  if (a.type === 'noul') return a.noul >= 0.5 ? 'yes' : 'no';
  const levels = q && q.type === 'score' ? q.levels : [];
  const nearest = levels[Math.round(a.score)];
  return nearest ? `${a.score.toFixed(1)} — ${nearest}` : a.score.toFixed(2);
}

export default function VerifyingPanel({
  row, result, questions, scoring,
}: {
  row: PanelRow | null;
  result: RowResult | undefined;
  questions: QuestionSpec[];
  scoring: boolean;
}) {
  if (!row) {
    return (
      <div className="panel p-5">
        <div className="label">Verifying profile</div>
        <p className="mt-3 text-sm" style={{ color: 'var(--muted)' }}>
          Start a run, or click anyone in the grid.
        </p>
      </div>
    );
  }

  return (
    <div className="panel p-5">
      <div className="flex items-baseline justify-between">
        <div className="label">Verifying profile</div>
        {row.tier && <span className="label">{TIER_LABELS[row.tier]}</span>}
      </div>

      <h2 className="serif mt-2 text-2xl leading-tight">{row.name || 'No name'}</h2>
      <div className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
        {row.position || <em>no position</em>}
        {row.company ? ` · ${row.company}` : ''}
        {row.connectedFor ? ` · connected ${row.connectedFor}` : ''}
      </div>
      {row.url && (
        <a href={row.url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs underline">
          Open on LinkedIn
        </a>
      )}

      <div className="mt-5 space-y-3">
        {result?.error && (
          <p className="text-sm" style={{ color: 'var(--accent)' }}>
            This row could not be scored: {result.error}
          </p>
        )}
        {!result && (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            {scoring ? 'Scoring…' : 'Not scored yet.'}
          </p>
        )}
        {result &&
          Object.entries(result.answers).map(([id, answer]) => {
            const q = questions.find((x) => x.id === id);
            const m = magnitude(answer);
            return (
              <div key={id}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="label">{id.replace(/_/g, ' ')}</span>
                  <Link href={`/studio#${id}`} className="text-[10px] underline" style={{ color: 'var(--muted)' }}>
                    Edit this question
                  </Link>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm">{readable(answer, q)}</span>
                  <span className="text-xs tabular-nums" style={{ color: 'var(--muted)' }}>
                    {(m * 100).toFixed(0)}
                  </span>
                </div>
                <div className={`bar mt-1 ${answer.type === 'noul' ? '' : 'neutral'}`}>
                  <span style={{ width: `${Math.max(0, Math.min(1, m)) * 100}%` }} />
                </div>
              </div>
            );
          })}
      </div>

      {result && !result.error && (
        <div className="mt-5 flex gap-4 text-xs" style={{ color: 'var(--muted)' }}>
          <span>{result.latencyMs} ms</span>
          <span>{result.inputTokens.toLocaleString()} tokens</span>
          {result.model && <span>{result.model}</span>}
        </div>
      )}
    </div>
  );
}
