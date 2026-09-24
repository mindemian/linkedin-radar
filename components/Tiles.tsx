'use client';

import type { RunProgress } from '@/lib/run';

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[7rem] flex-1">
      <div className="label">{label}</div>
      <div className="serif mt-0.5 text-2xl leading-none tabular-nums">{value}</div>
    </div>
  );
}

function elapsed(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function Tiles({
  p, tier1, headline = 'Tier 1 so far',
}: { p: RunProgress; tier1: number; headline?: string }) {
  return (
    <div className="flex flex-wrap gap-x-8 gap-y-4 border-y py-4 rule">
      <Tile label="Rows read" value={`${p.rowsRead.toLocaleString()} / ${p.totalRows.toLocaleString()}`} />
      <Tile label="Typed answers" value={p.typedAnswers.toLocaleString()} />
      <Tile label={headline} value={tier1.toLocaleString()} />
      <Tile label="Answers / sec" value={p.answersPerSecond.toFixed(1)} />
      <Tile label="Elapsed" value={elapsed(p.elapsedMs)} />
      <Tile label="Cost so far" value={`$${p.costUsd.toFixed(4)}`} />
    </div>
  );
}
