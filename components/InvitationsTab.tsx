'use client';

/**
 * The INVITATIONS tab.
 *
 * Three lists, and only one of them ever reaches Jev:
 *
 *   Incoming with a note  -> scored, then bucketed by bucketOfInvitation
 *   Incoming with no note -> never scored; there is nothing to judge
 *   Outgoing              -> never scored; the join in code says accepted or sent
 *
 * The filter that enforces that is scorableInvitations(), not a condition
 * written here, so the screen cannot drift from the rule the tests check.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import Tiles from '@/components/Tiles';
import { noSignalInvitations, scorableInvitations, type Invitation } from '@/lib/parse/invitations';
import { invitationState, bucketOfInvitation } from '@/lib/rows';
import { startRun, type RunHandle, type RunProgress } from '@/lib/run';
import { BUCKET_LABELS, type InvitationBucket } from '@/lib/tiers';
import { downloadCsv } from '@/lib/csv';
import type { Preset, RowResult } from '@/lib/spec/types';

const EMPTY: RunProgress = {
  rowsRead: 0, totalRows: 0, typedAnswers: 0, inputTokens: 0,
  elapsedMs: 0, costUsd: 0, answersPerSecond: 0, model: '',
};

const BUCKET_CLASS: Record<InvitationBucket, string> = {
  accept: 't1', review: 't3', ignore: 'trej', no_signal: 'tpending',
};

function when(d: Date | null) {
  return d ? d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
}

export default function InvitationsTab({
  rows, fileKey, preset, accepted, pending,
}: {
  /** Already run through joinWithConnections, so status is set. */
  rows: Invitation[];
  fileKey: string;
  preset: Preset;
  accepted: number;
  pending: number;
}) {
  const [results, setResults] = useState<Record<string, RowResult>>({});
  const [progress, setProgress] = useState<RunProgress>(EMPTY);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<InvitationBucket | 'all'>('all');
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const handle = useRef<RunHandle | null>(null);

  const questions = useMemo(
    () => preset.questions.filter((q) => q.tab === 'invitations'),
    [preset],
  );

  const scorable = useMemo(() => scorableInvitations(rows), [rows]);
  const noSignal = useMemo(() => noSignalInvitations(rows), [rows]);
  const outgoing = useMemo(() => rows.filter((r) => r.direction === 'OUTGOING'), [rows]);

  const bucketed = useMemo(
    () => scorable.map((i) => ({
      i,
      result: results[i.rowId],
      bucket: bucketOfInvitation(preset.id, i, results[i.rowId], preset.thresholds),
    })),
    [scorable, results, preset.id, preset.thresholds],
  );

  const counts = useMemo(() => {
    const out: Record<string, number> = { accept: 0, review: 0, ignore: 0 };
    for (const b of bucketed) out[b.bucket] = (out[b.bucket] ?? 0) + 1;
    out.no_signal = noSignal.length;
    return out;
  }, [bucketed, noSignal]);

  const visible = useMemo(
    () => (filter === 'all' || filter === 'no_signal'
      ? bucketed
      : bucketed.filter((b) => b.bucket === filter)),
    [bucketed, filter],
  );

  const run = useCallback(() => {
    setError(null);
    setRunning(true);
    handle.current = startRun({
      fileKey,
      rows: scorable.map((i) => ({ rowId: i.rowId, state: invitationState(i, questions) })),
      questions,
      alreadyScored: new Set(Object.keys(results)),
      onBatch: (batch, p) => {
        setResults((prev) => {
          const next = { ...prev };
          for (const r of batch) next[r.rowId] = r;
          return next;
        });
        setProgress(p);
      },
      onProgress: setProgress,
      onError: (m) => { setError(m); setRunning(false); },
      onDone: (p) => { setProgress(p); setRunning(false); },
    });
  }, [fileKey, scorable, questions, results]);

  const exportBucket = (b: InvitationBucket) => {
    const list = b === 'no_signal'
      ? noSignal.map((i) => ({ i, bucket: 'no_signal' as InvitationBucket }))
      : bucketed.filter((x) => x.bucket === b);
    downloadCsv(
      `linkedin-radar-invitations-${b}.csv`,
      list.map(({ i }) => ({
        'Name': i.name,
        'Sent': when(i.sentAt),
        'Age': i.invitation_age,
        'Message': i.message,
        'Bucket': BUCKET_LABELS[b],
        'Profile': i.inviterUrl,
      })),
      ['Name', 'Sent', 'Age', 'Message', 'Bucket', 'Profile'],
    );
  };

  const pickedCount = Object.values(picked).filter(Boolean).length;

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={running ? () => handle.current?.cancel() : run}
          disabled={scorable.length === 0}
          className="px-5 py-2 text-sm font-semibold disabled:opacity-40"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          {running ? 'Stop' : `Read ${scorable.length.toLocaleString()} notes`}
        </button>
        <span className="text-xs" style={{ color: 'var(--muted)' }}>
          {noSignal.length.toLocaleString()} incoming invitations carry no note and are never sent
          for scoring · {outgoing.length.toLocaleString()} outgoing, never scored
        </span>
      </div>

      {error && <p className="mt-3 text-sm" style={{ color: 'var(--accent)' }}>{error}</p>}

      <div className="mt-4">
        <Tiles
          p={{ ...progress, totalRows: progress.totalRows || scorable.length }}
          tier1={counts.accept}
          headline="Worth accepting"
        />
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {(['all', 'accept', 'review', 'ignore', 'no_signal'] as const).map((b) => (
          <button
            key={b}
            onClick={() => setFilter(b)}
            className={`px-3 py-1 text-xs font-medium ${b === 'all' ? 't3' : BUCKET_CLASS[b]}`}
            style={filter === b ? { boxShadow: '0 0 0 2px var(--accent)' } : {}}
          >
            {b === 'all' ? `All ${scorable.length}` : `${BUCKET_LABELS[b]} ${counts[b] ?? 0}`}
          </button>
        ))}
      </div>

      {filter !== 'no_signal' && (
        <section className="mt-4">
          <h2 className="label">Incoming, with a note</h2>
          <div className="panel mt-2 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase" style={{ color: 'var(--muted)' }}>
                <tr>
                  <th className="px-3 py-2">Bucket</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Age</th>
                  <th className="px-3 py-2">What they want</th>
                  <th className="px-3 py-2">Their note</th>
                </tr>
              </thead>
              <tbody>
                {visible.slice(0, 300).map(({ i, result, bucket }) => {
                  const intent = result?.answers.message_intent;
                  return (
                    <tr key={i.rowId} className="border-t rule align-top">
                      <td className="px-3 py-1.5 text-xs">
                        <span className={`px-2 py-0.5 ${BUCKET_CLASS[bucket]}`}>{BUCKET_LABELS[bucket]}</span>
                      </td>
                      <td className="px-3 py-1.5 whitespace-nowrap">
                        {i.inviterUrl
                          ? <a href={i.inviterUrl} target="_blank" rel="noreferrer" className="underline">{i.name || '—'}</a>
                          : (i.name || '—')}
                      </td>
                      <td className="px-3 py-1.5 whitespace-nowrap text-xs">{i.invitation_age}</td>
                      <td className="px-3 py-1.5 text-xs">
                        {intent && intent.type === 'choice'
                          ? `${intent.choice} ${(intent.confidence * 100).toFixed(0)}`
                          : ''}
                      </td>
                      <td className="px-3 py-1.5 text-xs" style={{ maxWidth: '38rem' }}>{i.message}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {visible.length === 0 && (
              <p className="p-3 text-xs" style={{ color: 'var(--muted)' }}>Nothing in this bucket.</p>
            )}
            {visible.length > 300 && (
              <p className="p-3 text-xs" style={{ color: 'var(--muted)' }}>
                Showing the first 300 of {visible.length.toLocaleString()}.
              </p>
            )}
          </div>
        </section>
      )}

      <section className="mt-6">
        <h2 className="label">No signal · {noSignal.length.toLocaleString()} incoming, no note</h2>
        <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
          Newest first. These are never sent for scoring, because an empty note gives nothing to
          judge. Tick the ones worth looking up later.
          {pickedCount > 0 && ` ${pickedCount} ticked.`}
        </p>
        <div className="panel mt-2 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase" style={{ color: 'var(--muted)' }}>
              <tr>
                <th className="px-3 py-2">Look up</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Sent</th>
                <th className="px-3 py-2">Age</th>
              </tr>
            </thead>
            <tbody>
              {noSignal.slice(0, 300).map((i) => (
                <tr key={i.rowId} className="border-t rule">
                  <td className="px-3 py-1.5">
                    <input
                      type="checkbox"
                      checked={!!picked[i.rowId]}
                      onChange={() => setPicked((p) => ({ ...p, [i.rowId]: !p[i.rowId] }))}
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    {i.inviterUrl
                      ? <a href={i.inviterUrl} target="_blank" rel="noreferrer" className="underline">{i.name || '—'}</a>
                      : (i.name || '—')}
                  </td>
                  <td className="px-3 py-1.5 text-xs whitespace-nowrap">{when(i.sentAt)}</td>
                  <td className="px-3 py-1.5 text-xs whitespace-nowrap">{i.invitation_age}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {noSignal.length === 0 && (
            <p className="p-3 text-xs" style={{ color: 'var(--muted)' }}>None.</p>
          )}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="label">Outgoing · {accepted.toLocaleString()} accepted, {pending.toLocaleString()} still pending</h2>
        <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
          Worked out in code by matching profile URLs against your Connections file. No scoring
          happens here at all. Load both files to see the counts.
        </p>
        <div className="panel mt-2 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase" style={{ color: 'var(--muted)' }}>
              <tr>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">To</th>
                <th className="px-3 py-2">Sent</th>
              </tr>
            </thead>
            <tbody>
              {outgoing.slice(0, 300).map((i) => (
                <tr key={i.rowId} className="border-t rule">
                  <td className="px-3 py-1.5 text-xs">{i.status === 'accepted' ? 'Accepted' : 'Sent'}</td>
                  <td className="px-3 py-1.5">
                    {i.inviteeUrl
                      ? <a href={i.inviteeUrl} target="_blank" rel="noreferrer" className="underline">{i.to || '—'}</a>
                      : (i.to || '—')}
                  </td>
                  <td className="px-3 py-1.5 text-xs whitespace-nowrap">{when(i.sentAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {outgoing.length === 0 && (
            <p className="p-3 text-xs" style={{ color: 'var(--muted)' }}>None in this export.</p>
          )}
        </div>
      </section>

      <div className="mt-5 flex flex-wrap gap-3">
        <button onClick={() => exportBucket('accept')} className="panel px-3 py-1.5 text-xs">
          Download Accept ({counts.accept ?? 0})
        </button>
        <button onClick={() => exportBucket('review')} className="panel px-3 py-1.5 text-xs">
          Download Review ({counts.review ?? 0})
        </button>
        <button onClick={() => exportBucket('no_signal')} className="panel px-3 py-1.5 text-xs">
          Download No signal ({noSignal.length})
        </button>
      </div>
    </>
  );
}
