'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Upload, { type LoadedFile } from '@/components/Upload';
import UploadBar from '@/components/UploadBar';
import Tiles from '@/components/Tiles';
import AvatarGrid, { type GridItem } from '@/components/AvatarGrid';
import VerifyingPanel, { type PanelRow } from '@/components/VerifyingPanel';
import { parseConnections, type ConnectionsParse } from '@/lib/parse/connections';
import {
  joinWithConnections, noSignalInvitations, parseInvitations, scorableInvitations,
  type InvitationsParse,
} from '@/lib/parse/invitations';
import { PRESETS, DEFAULT_PRESET_ID } from '@/lib/presets';
import { startRun, costOf, type RunHandle, type RunProgress } from '@/lib/run';
import { fileKey, loadResults, setFlags, allFlags } from '@/lib/store';
import { connectionState, fullName, initialsOf, tierOfConnection } from '@/lib/rows';
import { downloadCsv } from '@/lib/csv';
import { TIER_LABELS, type ConnectionTier } from '@/lib/tiers';
import type { RowResult } from '@/lib/spec/types';

const EMPTY_PROGRESS: RunProgress = {
  rowsRead: 0, totalRows: 0, typedAnswers: 0, inputTokens: 0,
  elapsedMs: 0, costUsd: 0, answersPerSecond: 0, model: '',
};

type Tab = 'connections' | 'invitations';

export default function Page() {
  const [connFile, setConnFile] = useState<LoadedFile | null>(null);
  const [invFile, setInvFile] = useState<LoadedFile | null>(null);
  const [conn, setConn] = useState<ConnectionsParse | null>(null);
  const [inv, setInv] = useState<InvitationsParse | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [presetId, setPresetId] = useState(DEFAULT_PRESET_ID);
  const [tab, setTab] = useState<Tab>('connections');
  const [results, setResults] = useState<Record<string, RowResult>>({});
  const [progress, setProgress] = useState<RunProgress>(EMPTY_PROGRESS);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [selected, setSelected] = useState<string | undefined>();
  const [tierFilter, setTierFilter] = useState<ConnectionTier | 'all'>('all');
  const [search, setSearch] = useState('');
  const [flags, setLocalFlags] = useState<Record<string, { dmSent?: boolean; accepted?: boolean }>>({});
  const [key, setKey] = useState('');
  const handle = useRef<RunHandle | null>(null);
  const onLoadRef = useRef<(f: LoadedFile) => Promise<void>>(async () => {});
  const [tick, setTick] = useState(0);

  const preset = useMemo(() => PRESETS.find((p) => p.id === presetId)!, [presetId]);
  const connQuestions = useMemo(
    () => preset.questions.filter((q) => q.tab === 'connections'),
    [preset],
  );

  // Keep the elapsed tile moving between batches.
  useEffect(() => {
    if (!running || paused) return;
    const t = setInterval(() => setTick((n) => n + 1), 500);
    return () => clearInterval(t);
  }, [running, paused]);

  useEffect(() => { allFlags().then(setLocalFlags); }, []);

  /** Shared by the empty state and the collapsed bar. */
  const onFile = useCallback(async (file: File, slot: 'connections' | 'invitations') => {
    const text = await file.text();
    const { identify, expectedColumnsMessage } = await import('@/lib/parse/detect');
    const kind = identify(text);
    if (kind === 'unknown') { setError(expectedColumnsMessage()); return; }
    await onLoadRef.current({ kind, name: file.name, text, ...(kind !== slot ? { movedFrom: slot } : {}) });
  }, []);

  const onLoad = useCallback(async (f: LoadedFile) => {
    setError(null);
    if (f.movedFrom) {
      setNotice(
        `${f.name} looked like the ${f.kind} export, not the ${f.movedFrom} one, so it was moved to the right slot.`,
      );
    } else {
      setNotice(null);
    }
    if (f.kind === 'connections') {
      const parsed = parseConnections(f.text);
      if (!parsed) { setError('That file could not be read.'); return; }
      setConnFile(f); setConn(parsed);
      const k = await fileKey(f.text);
      setKey(k);
      setResults(await loadResults(k));
    } else {
      const parsed = parseInvitations(f.text);
      if (!parsed) { setError('That file could not be read.'); return; }
      setInvFile(f); setInv(parsed);
    }
  }, []);

  onLoadRef.current = onLoad;

  const joined = useMemo(() => {
    if (!inv) return null;
    const keys = new Set((conn?.rows ?? []).map((c) => c.urlKey));
    return joinWithConnections(inv.rows, keys);
  }, [inv, conn]);

  const connectionsWithTier = useMemo(() => {
    if (!conn) return [];
    return conn.rows.map((c) => ({
      c,
      result: results[c.rowId],
      tier: tierOfConnection(presetId, c, results[c.rowId], preset.thresholds),
    }));
  }, [conn, results, presetId, preset.thresholds]);

  const tierCounts = useMemo(() => {
    const out: Record<string, number> = { tier1: 0, tier2: 0, tier3: 0, funder: 0, rejected: 0 };
    for (const r of connectionsWithTier) if (r.tier) out[r.tier] += 1;
    return out;
  }, [connectionsWithTier]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return connectionsWithTier.filter((r) => {
      if (tierFilter !== 'all' && r.tier !== tierFilter) return false;
      if (!q) return true;
      return (
        fullName(r.c.firstName, r.c.lastName).toLowerCase().includes(q) ||
        r.c.company.toLowerCase().includes(q) ||
        r.c.position.toLowerCase().includes(q)
      );
    });
  }, [connectionsWithTier, tierFilter, search]);

  const gridItems: GridItem[] = useMemo(
    () => visible.map((r) => ({
      rowId: r.c.rowId,
      initials: initialsOf(r.c.firstName, r.c.lastName),
      name: fullName(r.c.firstName, r.c.lastName) || r.c.company || 'No name',
      tier: r.tier,
    })),
    [visible],
  );

  const panelRow: PanelRow | null = useMemo(() => {
    const id = selected ?? progress.currentRowId;
    const found = connectionsWithTier.find((r) => r.c.rowId === id);
    if (!found) return null;
    return {
      rowId: found.c.rowId,
      name: fullName(found.c.firstName, found.c.lastName),
      position: found.c.position,
      company: found.c.company,
      connectedFor: found.c.connected_for,
      url: found.c.url,
      tier: found.tier,
    };
  }, [selected, progress.currentRowId, connectionsWithTier]);

  const run = useCallback(() => {
    if (!conn) return;
    setError(null);
    setRunning(true);
    setPaused(false);
    const rows = conn.rows.map((c) => ({
      rowId: c.rowId,
      state: connectionState(c, connQuestions),
    }));
    handle.current = startRun({
      fileKey: key,
      rows,
      questions: connQuestions,
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
  }, [conn, connQuestions, key, results]);

  const exportTier = (tier: ConnectionTier | 'all') => {
    const rows = connectionsWithTier
      .filter((r) => tier === 'all' || r.tier === tier)
      .map((r) => ({
        'First Name': r.c.firstName,
        'Last Name': r.c.lastName,
        'Company': r.c.company,
        'Position': r.c.position,
        'URL': r.c.url,
        'Email': r.c.hasEmail ? 'yes' : '',
        'Connected for': r.c.connected_for,
        'Tier': r.tier ? TIER_LABELS[r.tier] : 'not scored',
        'Role': (r.result?.answers.role as any)?.choice ?? '',
        'Confidence': (r.result?.answers.role as any)?.confidence?.toFixed(3) ?? '',
        'DM sent': flags[r.c.rowId]?.dmSent ? 'yes' : '',
        'Accepted': flags[r.c.rowId]?.accepted ? 'yes' : '',
      }));
    downloadCsv(
      `linkedin-radar-${tier}.csv`,
      rows,
      ['First Name', 'Last Name', 'Company', 'Position', 'URL', 'Email', 'Connected for',
       'Tier', 'Role', 'Confidence', 'DM sent', 'Accepted'],
    );
  };

  const toggleFlag = async (rowId: string, which: 'dmSent' | 'accepted') => {
    const next = { ...(flags[rowId] ?? {}), [which]: !flags[rowId]?.[which] };
    setLocalFlags((f) => ({ ...f, [rowId]: next }));
    await setFlags(rowId, next);
  };

  if (!connFile && !invFile) {
    return (
      <>
        <Upload
          connections={connFile}
          invitations={invFile}
          onLoad={onLoad}
          onReject={setError}
        />
        {error && (
          <p className="mx-auto max-w-4xl whitespace-pre-line px-6 text-sm" style={{ color: 'var(--accent)' }}>
            {error}
          </p>
        )}
      </>
    );
  }

  return (
    <main className="mx-auto max-w-[1500px] px-6 py-6">
      <header className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="serif text-3xl leading-none">LinkedIn Radar</h1>
        <div className="flex flex-wrap items-center gap-4">
          <select
            value={presetId}
            onChange={(e) => setPresetId(e.target.value)}
            className="panel px-2 py-1 text-sm"
          >
            {PRESETS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <Link href="/methods" className="text-xs underline">Methods</Link>
        </div>
      </header>

      <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>{preset.purpose}</p>

      <div className="mt-4">
        <UploadBar
          connections={connFile}
          invitations={invFile}
          connectionCount={conn?.rows.length ?? 0}
          invitationCount={inv?.rows.length ?? 0}
          onFile={onFile}
        />
      </div>

      {notice && <p className="mt-3 text-sm" style={{ color: 'var(--accent)' }}>{notice}</p>}
      {error && <p className="mt-3 whitespace-pre-line text-sm" style={{ color: 'var(--accent)' }}>{error}</p>}

      {conn && (
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs" style={{ color: 'var(--muted)' }}>
          <span>{conn.rows.length.toLocaleString()} parsed of {conn.rawLines.toLocaleString()} rows</span>
          <span>dates: {conn.dateFormat}</span>
          <span>{conn.emptyPosition.toLocaleString()} with no position</span>
          <span>{conn.emptyCompany.toLocaleString()} with no company</span>
          <span>{conn.withEmail.toLocaleString()} with an email</span>
          {inv && <span>{inv.withoutMessage.toLocaleString()} invitations with no message</span>}
          {joined && <span>{joined.accepted} accepted · {joined.pending} pending</span>}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={running ? () => { handle.current?.[paused ? 'resume' : 'pause'](); setPaused(!paused); } : run}
          disabled={!conn}
          className="px-5 py-2 text-sm font-semibold disabled:opacity-40"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          {running ? (paused ? 'Resume' : 'Pause') : 'Run'}
        </button>
        {running && (
          <button onClick={() => { handle.current?.cancel(); setRunning(false); }} className="text-xs underline">
            Stop
          </button>
        )}
        <span className="text-xs" style={{ color: 'var(--muted)' }}>
          {Object.keys(results).length.toLocaleString()} already scored
        </span>
      </div>

      <div className="mt-4">
        <Tiles p={{ ...progress, totalRows: progress.totalRows || (conn?.rows.length ?? 0) }} tier1={tierCounts.tier1} />
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {(['all', 'tier1', 'tier2', 'tier3', 'funder', 'rejected'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTierFilter(t)}
            className={`px-3 py-1 text-xs font-medium ${tierFilter === t ? 'ring-2' : ''} ${
              t === 'all' ? 't3' : t === 'tier1' ? 't1' : t === 'tier2' ? 't2' : t === 'tier3' ? 't3' : t === 'funder' ? 'tpending' : 'trej'
            }`}
            style={{ ...(tierFilter === t ? { boxShadow: '0 0 0 2px var(--accent)' } : {}) }}
          >
            {t === 'all' ? `All ${connectionsWithTier.length}` : `${TIER_LABELS[t]} ${tierCounts[t]}`}
          </button>
        ))}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, company, title"
          className="panel ml-auto px-2 py-1 text-xs"
        />
      </div>

      <div className="mt-4 grid gap-5 lg:grid-cols-[1fr_22rem]">
        <div className="panel h-[28rem] p-3">
          <AvatarGrid items={gridItems} selectedId={selected} onSelect={setSelected} />
        </div>
        <VerifyingPanel
          row={panelRow}
          result={panelRow ? results[panelRow.rowId] : undefined}
          questions={connQuestions}
          scoring={running}
        />
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button onClick={() => exportTier('tier1')} className="panel px-3 py-1.5 text-xs">
          Download Tier 1 ({tierCounts.tier1})
        </button>
        <button onClick={() => exportTier('tier2')} className="panel px-3 py-1.5 text-xs">
          Download Tier 2 ({tierCounts.tier2})
        </button>
        <button onClick={() => exportTier('funder')} className="panel px-3 py-1.5 text-xs">
          Download Funders ({tierCounts.funder})
        </button>
        <button onClick={() => exportTier('all')} className="panel px-3 py-1.5 text-xs">
          Download everything
        </button>
      </div>

      <div className="mt-6 overflow-x-auto panel">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase" style={{ color: 'var(--muted)' }}>
            <tr>
              <th className="px-3 py-2">Tier</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Position</th>
              <th className="px-3 py-2">Company</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Sure</th>
              <th className="px-3 py-2">DM</th>
              <th className="px-3 py-2">Acc</th>
            </tr>
          </thead>
          <tbody>
            {visible.slice(0, 300).map((r) => {
              const role = r.result?.answers.role as any;
              return (
                <tr key={r.c.rowId} className="border-t rule">
                  <td className="px-3 py-1.5 text-xs">{r.tier ? TIER_LABELS[r.tier] : '—'}</td>
                  <td className="px-3 py-1.5">
                    <a href={r.c.url} target="_blank" rel="noreferrer" className="underline">
                      {fullName(r.c.firstName, r.c.lastName) || '—'}
                    </a>
                  </td>
                  <td className="px-3 py-1.5">{r.c.position || <em style={{ color: 'var(--muted)' }}>none</em>}</td>
                  <td className="px-3 py-1.5">{r.c.company}</td>
                  <td className="px-3 py-1.5 text-xs">{role?.choice ?? ''}</td>
                  <td className="px-3 py-1.5 text-xs tabular-nums">{role ? (role.confidence * 100).toFixed(0) : ''}</td>
                  <td className="px-3 py-1.5">
                    <input type="checkbox" checked={!!flags[r.c.rowId]?.dmSent} onChange={() => toggleFlag(r.c.rowId, 'dmSent')} />
                  </td>
                  <td className="px-3 py-1.5">
                    <input type="checkbox" checked={!!flags[r.c.rowId]?.accepted} onChange={() => toggleFlag(r.c.rowId, 'accepted')} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {visible.length > 300 && (
          <p className="p-3 text-xs" style={{ color: 'var(--muted)' }}>
            Showing the first 300 of {visible.length.toLocaleString()}. Download to see them all.
          </p>
        )}
      </div>

      <footer className="mt-10 border-t pt-4 text-xs rule" style={{ color: 'var(--muted)' }}>
        Your files are read in this browser and never uploaded. Only the few fields your
        questions ask about are sent for scoring, and nothing is stored on any server.
      </footer>
    </main>
  );
}
