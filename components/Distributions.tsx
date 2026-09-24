'use client';

/**
 * Where the scored set actually landed.
 *
 * Every chart here is one series, so there is one fill (--mark, the rust that
 * passes the lightness and contrast checks on both surfaces) and no legend —
 * the heading names the series. Bar length is the only encoding; colouring
 * bars darker-where-bigger would spend the one free channel restating what
 * length already says.
 *
 * Counting is countBy() in lib/rows.ts, the same function the rest of the app
 * uses. Nothing here recomputes a total.
 */

import { useMemo, useState } from 'react';
import { countBy } from '@/lib/rows';
import type { Answer, Preset, RowResult } from '@/lib/spec/types';

type Bar = { label: string; value: number };

/** Ordinal charts keep their natural order; nominal ones sort by size. */
function CategoryChart({
  title, note, bars, ordered, asTable,
}: { title: string; note: string; bars: Bar[]; ordered: boolean; asTable: boolean }) {
  const rows = ordered ? bars : [...bars].sort((a, b) => b.value - a.value);
  const total = rows.reduce((n, b) => n + b.value, 0);
  const max = Math.max(1, ...rows.map((b) => b.value));

  if (rows.length === 0 || total === 0) return null;

  return (
    <figure className="panel m-0 p-4">
      <figcaption>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="mt-0.5 text-[11px]" style={{ color: 'var(--muted)' }}>{note}</p>
      </figcaption>

      {asTable ? (
        <table className="mt-3 w-full text-left text-xs">
          <thead style={{ color: 'var(--muted)' }}>
            <tr><th className="py-1 font-normal">Answer</th><th className="py-1 text-right font-normal">Rows</th><th className="py-1 text-right font-normal">Share</th></tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.label} className="border-t rule">
                <td className="py-1 pr-2">{b.label}</td>
                <td className="py-1 text-right tabular-nums">{b.value.toLocaleString()}</td>
                <td className="py-1 text-right tabular-nums">{((b.value / total) * 100).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        // A row per bar, 2px apart, each ≥24px tall so the whole row is the
        // hit target. The count is written beside every bar, so nothing here
        // is reachable only by hovering.
        <ul className="mt-3 list-none space-y-0.5 p-0">
          {rows.map((b) => (
            <li key={b.label} className="grid grid-cols-[9rem_1fr_3rem] items-center gap-2 py-1">
              <span className="truncate text-[11px]" title={b.label}>{b.label}</span>
              <span className="block h-2.5" aria-hidden>
                <span
                  className="block h-full"
                  style={{
                    width: `${Math.max(2, (b.value / max) * 100)}%`,
                    background: 'var(--mark)',
                    borderTopRightRadius: 4,
                    borderBottomRightRadius: 4,
                  }}
                />
              </span>
              <span className="text-right text-[11px] tabular-nums">{b.value.toLocaleString()}</span>
            </li>
          ))}
        </ul>
      )}
      <hr className="mt-2 border-t rule" />
      <p className="mt-1 text-[10px] tabular-nums" style={{ color: 'var(--muted)' }}>
        {total.toLocaleString()} answered
      </p>
    </figure>
  );
}

const pick = (a: Answer | undefined): string | undefined =>
  a && a.type === 'choice' ? a.choice : undefined;

export default function Distributions({
  preset, results, connectedFor,
}: {
  preset: Preset;
  results: Record<string, RowResult>;
  /** connected_for bucket per row, computed in code from the dates. */
  connectedFor: string[];
}) {
  const [asTable, setAsTable] = useState(false);

  const scored = useMemo(() => Object.values(results).filter((r) => !r.error), [results]);

  /**
   * One chart per choice question that actually has answers. Enrichment
   * questions appear here on their own once a second pass has filled them in;
   * nothing about country or company size is special-cased.
   */
  const charts = useMemo(() => {
    const out: { id: string; bars: Bar[] }[] = [];
    for (const q of preset.questions) {
      if (q.type !== 'choice') continue;
      const counts = countBy(scored, (r) => pick(r.answers[q.id]));
      const bars = Object.entries(counts).map(([label, value]) => ({ label, value }));
      if (bars.length > 0) out.push({ id: q.id, bars });
    }
    return out;
  }, [preset.questions, scored]);

  const ageBars = useMemo(() => {
    const order = ['under 1 year', '1–3 years', '3+ years', 'unknown'];
    const counts = countBy(connectedFor, (b) => b);
    return order.filter((k) => counts[k] > 0).map((label) => ({ label, value: counts[label] }));
  }, [connectedFor]);

  if (scored.length === 0) return null;

  return (
    <section className="mt-8" data-testid="distributions">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="label">Where they landed</h2>
        <button onClick={() => setAsTable((t) => !t)} className="text-xs underline">
          {asTable ? 'Show as charts' : 'Show as tables'}
        </button>
      </div>

      <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {ageBars.length > 0 && (
          <CategoryChart
            title="How long you have been connected"
            note="Worked out in code from the Connected On dates, never asked of the model."
            bars={ageBars}
            ordered
            asTable={asTable}
          />
        )}
        {charts.map((c) => (
          <CategoryChart
            key={c.id}
            title={c.id.replace(/_/g, ' ')}
            note="What the model picked, across every row scored so far."
            bars={c.bars}
            ordered={false}
            asTable={asTable}
          />
        ))}
      </div>
    </section>
  );
}
