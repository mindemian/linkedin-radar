'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import QuestionCard from '@/components/studio/QuestionCard';
import { PRESETS, DEFAULT_PRESET_ID } from '@/lib/presets';
import { fork, exportJson, importJson } from '@/lib/presets/fork';
import { allPresets, persist, remove } from '@/lib/presets/custom';
import { isBuiltIn } from '@/lib/presets/fork';
import { validateQuestions, hasBlockingError } from '@/lib/spec/validate';
import { describeStaleness, staleness } from '@/lib/spec/hash';
import { countTiers, TIER_LABELS, type TierInput } from '@/lib/tiers';
import { loadResults, getActivePreset, setActivePreset, getActiveFileKey } from '@/lib/store';
import { costOf } from '@/lib/run';
import type { Preset, RowResult } from '@/lib/spec/types';
import type { WithPrevious } from '@/lib/spec/convert';

export default function Studio() {
  const [presets, setPresets] = useState<Preset[]>(PRESETS);
  const [activeId, setActiveId] = useState(DEFAULT_PRESET_ID);
  const [draft, setDraft] = useState<Preset>(PRESETS[0]);
  const [results, setResults] = useState<Record<string, RowResult>>({});
  const [saved, setSaved] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const all = await allPresets();
      setPresets(all);
      const active = (await getActivePreset()) ?? DEFAULT_PRESET_ID;
      const found = all.find((p) => p.id === active) ?? all[0];
      setActiveId(found.id);
      setDraft(found);
      // Results are keyed by the uploaded file, so the Studio has to ask which
      // upload was scored. Passing an empty key here returns nothing and makes
      // the whole page look broken while reporting no error at all.
      const key = await getActiveFileKey();
      if (key) setResults(await loadResults(key));
    })();
  }, []);

  const errors = useMemo(() => validateQuestions(draft.questions), [draft.questions]);
  const blocked = hasBlockingError(errors);

  const stale = useMemo(
    () => staleness(results as Record<string, { questionHashes?: Record<string, string> }>, draft.questions),
    [results, draft.questions],
  );
  const staleMessage = describeStaleness(stale);

  const tierInputs: TierInput[] = useMemo(
    () => Object.values(results)
      .filter((r) => !r.error)
      .map((r) => ({ answers: r.answers, positionEmpty: false })),
    [results],
  );
  const counts = useMemo(
    () => countTiers(draft.id.startsWith('innovation') ? 'innovation-roles' : 'grant-clients', tierInputs, draft.thresholds),
    [tierInputs, draft.thresholds, draft.id],
  );

  const avgTokens = useMemo(() => {
    const scored = Object.values(results).filter((r) => r.inputTokens > 0);
    if (scored.length === 0) return 0;
    return scored.reduce((n, r) => n + r.inputTokens, 0) / scored.length;
  }, [results]);

  /** The first edit to a shipped preset forks it rather than mutating it. */
  const edit = useCallback((next: Preset) => {
    setDraft((cur) => (isBuiltIn(cur.id) ? { ...fork(cur, presets), ...next, id: fork(cur, presets).id, name: fork(cur, presets).name } : next));
  }, [presets]);

  const editQuestion = (i: number, q: WithPrevious) => {
    const questions = draft.questions.map((x, j) => (j === i ? q : x));
    edit({ ...draft, questions });
  };

  const save = async () => {
    const toSave = isBuiltIn(draft.id) ? fork(draft, presets) : draft;
    await persist(toSave);
    const all = await allPresets();
    setPresets(all);
    setDraft(toSave);
    setActiveId(toSave.id);
    await setActivePreset(toSave.id);
    setSaved(`Saved as "${toSave.name}".`);
    setTimeout(() => setSaved(null), 4000);
  };

  const download = () => {
    const blob = new Blob([exportJson(draft)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${draft.id}.json`;
    a.click();
  };

  const upload = async (file: File) => {
    setImportError(null);
    const result = importJson(await file.text(), presets);
    if (!result.ok) {
      setImportError(
        result.message + (result.errors?.length ? ` ${result.errors.map((e) => e.message).join(' ')}` : ''),
      );
      return;
    }
    await persist(result.preset);
    const all = await allPresets();
    setPresets(all);
    setDraft(result.preset);
    setActiveId(result.preset.id);
  };

  const shipped = PRESETS.find((p) => draft.id.startsWith(p.id)) ?? PRESETS[0];

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <Link href="/" className="label">← Back</Link>
          <h1 className="serif mt-2 text-4xl leading-none">Classifier Studio</h1>
        </div>
        <Link href="/methods" className="text-xs underline">Methods</Link>
      </div>

      <p className="mt-3 max-w-2xl text-sm" style={{ color: 'var(--muted)' }}>
        Every question the model is asked, and every cutoff, editable here. Shipped presets
        are read-only: your first edit makes a copy, so there is always something to go back to.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <select
          value={activeId}
          onChange={async (e) => {
            const p = presets.find((x) => x.id === e.target.value)!;
            setActiveId(p.id); setDraft(p); await setActivePreset(p.id);
          }}
          className="panel px-2 py-1 text-sm"
        >
          {presets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button onClick={save} disabled={blocked} className="px-4 py-1.5 text-sm font-semibold disabled:opacity-40" style={{ background: 'var(--accent)', color: '#fff' }}>
          Save
        </button>
        <button onClick={download} className="text-xs underline">Download JSON</button>
        <label className="text-xs underline cursor-pointer">
          Upload JSON
          <input type="file" accept="application/json" className="hidden" aria-label="preset json"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} />
        </label>
        <button onClick={() => setDraft(shipped)} className="text-xs underline">Reset to defaults</button>
        {!isBuiltIn(draft.id) && (
          <button onClick={async () => { await remove(draft.id); setPresets(await allPresets()); setDraft(shipped); setActiveId(shipped.id); }}
            className="text-xs underline" style={{ color: 'var(--accent)' }}>
            Delete this preset
          </button>
        )}
        {saved && <span className="text-xs" style={{ color: 'var(--accent)' }}>{saved}</span>}
      </div>

      {importError && <p className="mt-3 text-sm" style={{ color: 'var(--accent)' }}>{importError}</p>}

      {/* The whole reason versioning exists. */}
      {staleMessage && (
        <div className="mt-6 border p-4 text-sm" style={{ borderColor: 'var(--accent)' }} data-testid="stale-warning">
          {staleMessage}
        </div>
      )}

      <section className="mt-8">
        <div className="flex items-baseline justify-between">
          <h2 className="label">Thresholds</h2>
          <span className="text-[10px]" style={{ color: 'var(--muted)' }}>
            Free. Moving these re-sorts everyone from answers already stored, with no new scoring.
          </span>
        </div>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {draft.sliders.map((s) => (
            <label key={s.key} className="block">
              <span className="flex items-baseline justify-between text-xs">
                <span>{s.label}</span>
                <span className="tabular-nums">{(draft.thresholds[s.key] ?? 0).toFixed(2)}</span>
              </span>
              <input
                type="range" min={s.min} max={s.max} step={s.step}
                value={draft.thresholds[s.key] ?? 0}
                aria-label={s.label}
                onChange={(e) => edit({ ...draft, thresholds: { ...draft.thresholds, [s.key]: Number(e.target.value) } })}
                className="mt-1 w-full"
              />
              <span className="text-[10px]" style={{ color: 'var(--muted)' }}>{s.explains}</span>
            </label>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2" data-testid="tier-counts">
          {(['tier1', 'tier2', 'tier3', 'funder', 'rejected'] as const).map((t) => (
            <span key={t} className="px-2 py-1 text-xs" style={{ background: 'var(--rule)' }}>
              {TIER_LABELS[t]} {counts[t]}
            </span>
          ))}
          {tierInputs.length === 0 && (
            <span className="text-xs" style={{ color: 'var(--muted)' }}>
              Run the scorer first and these fill in.
            </span>
          )}
        </div>
      </section>

      <section className="mt-10">
        <div className="flex items-baseline justify-between">
          <h2 className="label">Questions</h2>
          <span className="text-[10px]" style={{ color: 'var(--muted)' }}>
            Not free. Editing a question means the stored answers no longer match it.
          </span>
        </div>

        {avgTokens > 0 && (
          <p className="mt-2 text-xs" style={{ color: 'var(--muted)' }}>
            A full re-run of {Object.keys(results).length.toLocaleString()} rows would cost about{' '}
            ${costOf(avgTokens * Object.keys(results).length).toFixed(4)}.
          </p>
        )}

        <div className="mt-4 space-y-5">
          {draft.questions.map((q, i) => (
            <QuestionCard
              key={`${q.id}-${i}`}
              q={q as WithPrevious}
              errors={errors}
              onChange={(next) => editQuestion(i, next)}
              onDelete={() => edit({ ...draft, questions: draft.questions.filter((_, j) => j !== i) })}
              onDuplicate={() => {
                const copy = structuredClone(draft.questions[i]);
                copy.id = `${copy.id}_copy`;
                edit({ ...draft, questions: [...draft.questions.slice(0, i + 1), copy, ...draft.questions.slice(i + 1)] });
              }}
              onMove={(d) => {
                const j = i + d;
                if (j < 0 || j >= draft.questions.length) return;
                const n = [...draft.questions];
                [n[i], n[j]] = [n[j], n[i]];
                edit({ ...draft, questions: n });
              }}
            />
          ))}
        </div>

        <button
          onClick={() => edit({
            ...draft,
            questions: [...draft.questions, {
              id: 'new_question', tab: 'connections', type: 'noul', enabled: true,
              fields: ['position'], instructions: '',
            }],
          })}
          className="mt-5 text-sm underline"
        >
          Add a question
        </button>
      </section>

      {blocked && (
        <p className="mt-6 text-sm" style={{ color: 'var(--accent)' }}>
          Fix the errors above before saving. The scoring service enforces the same rules, so
          a preset that fails here would be refused there too.
        </p>
      )}
    </main>
  );
}
