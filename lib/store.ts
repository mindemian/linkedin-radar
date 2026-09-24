'use client';

/**
 * Everything the app remembers lives in the browser: parsed rows, answers,
 * presets, and the hand-set "DM sent" / "Accepted" flags. Nothing is sent
 * anywhere except the contract fields that go to /api/score.
 *
 * Results are keyed by a hash of the uploaded file, so reopening the tab after
 * a 2,000-row run resumes instead of starting again.
 */

import { openDB, type IDBPDatabase } from 'idb';
import type { Tab } from './contract';
import type { Preset, RowResult } from './spec/types';

const DB_NAME = 'linkedin-radar';
const VERSION = 2;

type Flags = { dmSent?: boolean; accepted?: boolean };

let dbp: Promise<IDBPDatabase> | undefined;

function db() {
  dbp ??= openDB(DB_NAME, VERSION, {
    upgrade(d, from) {
      // A browser that already holds a v1 database only needs the new store.
      if (from >= 1) {
        if (!d.objectStoreNames.contains('rows')) d.createObjectStore('rows');
        return;
      }
      d.createObjectStore('results');   // `${fileKey}:${rowId}` -> RowResult
      d.createObjectStore('presets');   // name -> Preset
      d.createObjectStore('flags');     // rowId -> Flags
      d.createObjectStore('meta');      // misc: active preset name, file keys
      d.createObjectStore('rows');      // `${fileKey}:${rowId}` -> StoredRow
    },
  });
  return dbp;
}

/** Cheap, stable, and good enough to tell two uploads apart. */
export async function fileKey(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text.slice(0, 200_000));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function saveResults(key: string, results: RowResult[]): Promise<void> {
  const d = await db();
  const tx = d.transaction('results', 'readwrite');
  await Promise.all(results.map((r) => tx.store.put(r, `${key}:${r.rowId}`)));
  await tx.done;
}

export async function loadResults(key: string): Promise<Record<string, RowResult>> {
  const d = await db();
  const out: Record<string, RowResult> = {};
  let cursor = await d.transaction('results').store.openCursor();
  while (cursor) {
    const k = String(cursor.key);
    if (k.startsWith(`${key}:`)) out[k.slice(key.length + 1)] = cursor.value as RowResult;
    cursor = await cursor.continue();
  }
  return out;
}

export async function clearResults(key: string): Promise<void> {
  const d = await db();
  const tx = d.transaction('results', 'readwrite');
  let cursor = await tx.store.openCursor();
  while (cursor) {
    if (String(cursor.key).startsWith(`${key}:`)) await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
}

/**
 * The contract fields of every parsed row, so the Studio can re-run and
 * test-run without the user re-picking the file. Nothing else from the upload
 * is kept: these are exactly the fields that would go to /api/score anyway.
 */
export type StoredRow = { rowId: string; tab: Tab; fields: Record<string, string> };

export async function saveRows(key: string, rows: StoredRow[]): Promise<void> {
  const d = await db();
  const tx = d.transaction('rows', 'readwrite');
  await Promise.all(rows.map((r) => tx.store.put(r, `${key}:${r.rowId}`)));
  await tx.done;
}

export async function loadRows(key: string): Promise<StoredRow[]> {
  const d = await db();
  const out: StoredRow[] = [];
  let cursor = await d.transaction('rows').store.openCursor();
  while (cursor) {
    if (String(cursor.key).startsWith(`${key}:`)) out.push(cursor.value as StoredRow);
    cursor = await cursor.continue();
  }
  return out;
}

export async function savePreset(p: Preset): Promise<void> {
  (await db()).put('presets', p, p.name);
}

export async function listPresets(): Promise<Preset[]> {
  return (await db()).getAll('presets');
}

export async function deletePreset(name: string): Promise<void> {
  (await db()).delete('presets', name);
}

export async function setActivePreset(name: string): Promise<void> {
  (await db()).put('meta', name, 'activePreset');
}

export async function getActivePreset(): Promise<string | undefined> {
  return (await db()).get('meta', 'activePreset');
}

/**
 * Which upload the last run scored. The Studio needs it to show real tier
 * counts and real staleness; without it the Studio silently shows zeroes and
 * looks broken.
 */
export async function setActiveFileKey(key: string): Promise<void> {
  (await db()).put('meta', key, 'activeFileKey');
}

export async function getActiveFileKey(): Promise<string | undefined> {
  return (await db()).get('meta', 'activeFileKey');
}

export async function setFlags(rowId: string, flags: Flags): Promise<void> {
  const d = await db();
  const existing = ((await d.get('flags', rowId)) ?? {}) as Flags;
  await d.put('flags', { ...existing, ...flags }, rowId);
}

export async function allFlags(): Promise<Record<string, Flags>> {
  const d = await db();
  const out: Record<string, Flags> = {};
  let cursor = await d.transaction('flags').store.openCursor();
  while (cursor) {
    out[String(cursor.key)] = cursor.value as Flags;
    cursor = await cursor.continue();
  }
  return out;
}
