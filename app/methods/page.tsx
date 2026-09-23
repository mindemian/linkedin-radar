import Link from 'next/link';
import { PRESETS } from '@/lib/presets';
import { CONTRACT, CODE_OWNED, FORBIDDEN_PRE_ENRICHMENT } from '@/lib/contract';
import { ACTOR_ID } from '@/lib/apify.config';
import { EXCLUDED_COMPANY_TYPES } from '@/lib/tiers';

/**
 * Everything the app believes, in one place, verbatim. This is the honest
 * answer to "why did it say that" — and the reason it ships before the editor
 * rather than with it.
 */
export default function Methods() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/" className="label">← Back</Link>
      <h1 className="serif mt-4 text-4xl leading-none">Methods</h1>
      <p className="mt-3 text-sm" style={{ color: 'var(--muted)' }}>
        Every question asked of the model, word for word, with the rules that turn its
        answers into tiers. Nothing here is hidden from you, and nothing about a person
        is judged from a field that is not in a LinkedIn export.
      </p>

      <section className="mt-10">
        <h2 className="label">What the model may read</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {Object.entries(CONTRACT).map(([tab, fields]) => (
            <li key={tab}>
              <strong>{tab}</strong>: {fields.join(', ')}
            </li>
          ))}
        </ul>

        <h2 className="label mt-6">Never asked of the model before enrichment</h2>
        <p className="mt-2 text-sm">{FORBIDDEN_PRE_ENRICHMENT.join(', ')}.</p>
        <p className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>
          None of these are in a LinkedIn export, so asking would mean inviting a guess.
          A question naming one fails the build.
        </p>

        <h2 className="label mt-6">Computed in code, never asked</h2>
        <p className="mt-2 text-sm">{CODE_OWNED.join(', ')}.</p>

        <h2 className="label mt-6">Excluded by policy, not by the model</h2>
        <p className="mt-2 text-sm">
          {EXCLUDED_COMPANY_TYPES.join(', ')}. A university genuinely does apply for grants,
          so the model answers honestly and the exclusion is applied afterwards in code.
          A question that has to misdescribe the world in one place cannot be trusted in
          another.
        </p>

        <h2 className="label mt-6">Enrichment</h2>
        <p className="mt-2 text-sm">
          {ACTOR_ID
            ? `Apify actor ${ACTOR_ID}.`
            : 'No Apify actor is selected, so profile enrichment is off. The second-pass ' +
              'questions below run only against enrichment data imported by hand.'}
        </p>
      </section>

      {PRESETS.map((preset) => (
        <section key={preset.id} className="mt-14">
          <h2 className="serif text-2xl">{preset.name}</h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>{preset.purpose}</p>

          <pre className="panel mt-4 whitespace-pre-wrap p-4 text-xs leading-relaxed">{preset.icp}</pre>

          <h3 className="label mt-6">Thresholds</h3>
          <ul className="mt-2 space-y-2 text-sm">
            {preset.sliders.map((s) => (
              <li key={s.key}>
                <strong>{s.label}</strong>: {preset.thresholds[s.key]}
                <div className="text-xs" style={{ color: 'var(--muted)' }}>{s.explains}</div>
              </li>
            ))}
          </ul>

          <h3 className="label mt-6">Questions</h3>
          <div className="mt-2 space-y-8">
            {preset.questions.map((q) => (
              <article key={q.id} className="panel p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h4 className="serif text-lg">{q.id.replace(/_/g, ' ')}</h4>
                  <span className="label">{q.type} · {q.tab} · reads {q.fields.join(', ')}</span>
                </div>
                <pre className="mt-3 whitespace-pre-wrap text-xs leading-relaxed">{q.instructions}</pre>

                {q.type === 'choice' && (
                  <dl className="mt-3 space-y-2">
                    {q.options.map((o) => (
                      <div key={o.name}>
                        <dt className="text-xs font-semibold">{o.name}</dt>
                        <dd className="text-xs" style={{ color: 'var(--muted)' }}>{o.criterion}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                {q.type === 'score' && (
                  <ol className="mt-3 space-y-1 text-xs" style={{ color: 'var(--muted)' }}>
                    {q.levels.map((l, i) => <li key={i}>{i}. {l}</li>)}
                  </ol>
                )}
                {q.type === 'noul' && (q.whenTrue || q.whenFalse) && (
                  <dl className="mt-3 space-y-2 text-xs">
                    {q.whenTrue && (
                      <div><dt className="font-semibold">yes</dt><dd style={{ color: 'var(--muted)' }}>{q.whenTrue}</dd></div>
                    )}
                    {q.whenFalse && (
                      <div><dt className="font-semibold">no</dt><dd style={{ color: 'var(--muted)' }}>{q.whenFalse}</dd></div>
                    )}
                  </dl>
                )}
              </article>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
