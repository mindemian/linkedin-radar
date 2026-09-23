'use client';

/**
 * The storage side of presets. Every decision lives in ./fork, which has no
 * browser dependency and is therefore tested directly; this file only moves
 * things in and out of IndexedDB.
 */

import { deletePreset, listPresets, savePreset } from '../store';
import { isBuiltIn } from './fork';
import type { Preset } from '../spec/types';
import { PRESETS } from './index';

export async function allPresets(): Promise<Preset[]> {
  const custom = await listPresets();
  return [...PRESETS, ...custom.filter((c) => !isBuiltIn(c.id))];
}

export async function persist(p: Preset): Promise<void> {
  if (isBuiltIn(p.id)) throw new Error('A shipped preset cannot be overwritten. Fork it first.');
  await savePreset(p);
}

export async function remove(id: string): Promise<void> {
  if (isBuiltIn(id)) throw new Error('A shipped preset cannot be deleted.');
  await deletePreset(id);
}
