'use client';

import { useState } from 'react';
import { allowedFields, type Tab } from '@/lib/contract';
import { convert, describeLoss, type WithPrevious } from '@/lib/spec/convert';
import type { QuestionSpec } from '@/lib/spec/types';
import type { SpecError } from '@/lib/spec/validate';

const TYPES: QuestionSpec['type'][] = ['choice', 'score', 'noul'];

function Field({ label, value, onChange, rows = 4 }: {
  label: string; value: string; onChange: (v: string) => void; rows?: number;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <textarea
        value={value}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        className="panel mt-1 w-full p-2 font-mono text-xs leading-relaxed"
      />
    </label>
  );
}

export default function QuestionCard({
  q, errors, availableFields, onChange, onDelete, onDuplicate, onMove,
}: {
  q: WithPrevious;
  errors: SpecError[];
  /** Columns actually present in the current upload, or undefined if none loaded. */
  availableFields?: readonly string[];
  onChange: (next: WithPrevious) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMove: (delta: number) => void;
}) {
  const [pendingType, setPendingType] = useState<QuestionSpec['type'] | null>(null);
  const mine = errors.filter((e) => e.questionId === q.id);
  const blocking = mine.filter((e) => e.severity === 'error');
  const warnings = mine.filter((e) => e.severity === 'warning');
  const contractFields = allowedFields(q.tab as Tab);

  const loss = pendingType ? describeLoss(q, pendingType) : null;

  return (
    <article className={`panel p-4 ${blocking.length ? 'border-[var(--accent)]' : ''}`} style={{ opacity: q.enabled ? 1 : 0.55 }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <input
          value={q.id}
          onChange={(e) => onChange({ ...q, id: e.target.value })}
          className="serif bg-transparent text-lg outline-none"
          style={{ borderBottom: '1px solid var(--rule)' }}
        />
        <div className="flex items-center gap-2 text-xs">
          <select
            value={q.type}
            onChange={(e) => {
              const to = e.target.value as QuestionSpec['type'];
              if (describeLoss(q, to)) setPendingType(to);
              else onChange(convert(q, to));
            }}
            className="panel px-1 py-0.5"
          >
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={q.enabled} onChange={(e) => onChange({ ...q, enabled: e.target.checked })} />
            on
          </label>
          <button onClick={() => onMove(-1)} className="underline" aria-label="move up">↑</button>
          <button onClick={() => onMove(1)} className="underline" aria-label="move down">↓</button>
          <button onClick={onDuplicate} className="underline">Copy</button>
          <button onClick={onDelete} className="underline" style={{ color: 'var(--accent)' }}>Delete</button>
        </div>
      </div>

      {/* The conversion warning: shown before it happens, not after. */}
      {pendingType && loss && (
        <div className="mt-3 border p-3 text-xs" style={{ borderColor: 'var(--accent)' }}>
          <p>{loss}</p>
          <p className="mt-1" style={{ color: 'var(--muted)' }}>
            It is kept, and comes back if you convert to {q.type} again.
          </p>
          <div className="mt-2 flex gap-3">
            <button onClick={() => { onChange(convert(q, pendingType)); setPendingType(null); }} className="underline">
              Convert to {pendingType}
            </button>
            <button onClick={() => setPendingType(null)} className="underline" style={{ color: 'var(--muted)' }}>
              Keep it as {q.type}
            </button>
          </div>
        </div>
      )}

      <div className="mt-3">
        <Field label="Instructions" value={q.instructions} onChange={(v) => onChange({ ...q, instructions: v })} rows={6} />
      </div>

      <div className="mt-3">
        <span className="label">Reads</span>
        <div className="mt-1 flex flex-wrap gap-3 text-xs">
          {contractFields.map((f) => {
            const missing = availableFields && !availableFields.includes(f);
            return (
              <label key={f} className="flex items-center gap-1" title={missing ? 'not present in the file you uploaded' : ''}>
                <input
                  type="checkbox"
                  checked={q.fields.includes(f)}
                  onChange={(e) => onChange({
                    ...q,
                    fields: e.target.checked ? [...q.fields, f] : q.fields.filter((x) => x !== f),
                  })}
                />
                <span style={missing ? { color: 'var(--muted)', textDecoration: 'line-through' } : undefined}>{f}</span>
              </label>
            );
          })}
        </div>
        <p className="mt-1 text-[10px]" style={{ color: 'var(--muted)' }}>
          Only these exist in a LinkedIn export. Anything else would be a guess, so it is not offered.
        </p>
      </div>

      {q.type === 'choice' && (
        <div className="mt-4 space-y-2">
          <span className="label">Options</span>
          {q.options.map((o, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={o.name}
                onChange={(e) => onChange({
                  ...q,
                  options: q.options.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)),
                })}
                className="panel w-40 shrink-0 p-1 font-mono text-xs"
              />
              <textarea
                value={o.criterion}
                rows={2}
                onChange={(e) => onChange({
                  ...q,
                  options: q.options.map((x, j) => (j === i ? { ...x, criterion: e.target.value } : x)),
                })}
                className="panel w-full p-1 text-xs"
              />
              <div className="flex shrink-0 flex-col text-[10px]">
                <button onClick={() => { const n = [...q.options]; if (i > 0) { [n[i-1], n[i]] = [n[i], n[i-1]]; onChange({ ...q, options: n }); } }}>↑</button>
                <button onClick={() => { const n = [...q.options]; if (i < n.length-1) { [n[i+1], n[i]] = [n[i], n[i+1]]; onChange({ ...q, options: n }); } }}>↓</button>
                <button onClick={() => onChange({ ...q, options: q.options.filter((_, j) => j !== i) })} style={{ color: 'var(--accent)' }}>×</button>
              </div>
            </div>
          ))}
          <button
            onClick={() => onChange({ ...q, options: [...q.options, { name: 'new_option', criterion: '' }] })}
            className="text-xs underline"
          >
            Add an option
          </button>
        </div>
      )}

      {q.type === 'score' && (
        <div className="mt-4 space-y-2">
          <span className="label">Levels, lowest first</span>
          {q.levels.map((l, i) => (
            <div key={i} className="flex gap-2">
              <span className="w-6 shrink-0 text-xs tabular-nums" style={{ color: 'var(--muted)' }}>{i}</span>
              <textarea
                value={l}
                rows={1}
                onChange={(e) => onChange({ ...q, levels: q.levels.map((x, j) => (j === i ? e.target.value : x)) })}
                className="panel w-full p-1 text-xs"
              />
              <button onClick={() => onChange({ ...q, levels: q.levels.filter((_, j) => j !== i) })} className="text-[10px]" style={{ color: 'var(--accent)' }}>×</button>
            </div>
          ))}
          {q.levels.length < 10 && (
            <button onClick={() => onChange({ ...q, levels: [...q.levels, ''] })} className="text-xs underline">
              Add a level
            </button>
          )}
        </div>
      )}

      {q.type === 'noul' && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="When the answer is yes" value={q.whenTrue ?? ''} onChange={(v) => onChange({ ...q, whenTrue: v })} rows={4} />
          <Field label="When the answer is no" value={q.whenFalse ?? ''} onChange={(v) => onChange({ ...q, whenFalse: v })} rows={4} />
        </div>
      )}

      {(blocking.length > 0 || warnings.length > 0) && (
        <ul className="mt-3 space-y-1 text-xs">
          {blocking.map((e, i) => <li key={`e${i}`} style={{ color: 'var(--accent)' }}>{e.message}</li>)}
          {warnings.map((e, i) => <li key={`w${i}`} style={{ color: 'var(--muted)' }}>{e.message}</li>)}
        </ul>
      )}
    </article>
  );
}
