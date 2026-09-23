import type { Preset } from '../spec/types';
import { GRANT_CLIENTS } from './grant-clients';
import { INNOVATION_ROLES } from './innovation-roles';

/** Every shipped preset. The build check iterates this, so adding one here is
 *  enough to have it validated against the field contract. */
export const PRESETS: Preset[] = [GRANT_CLIENTS, INNOVATION_ROLES];

export const DEFAULT_PRESET_ID = GRANT_CLIENTS.id;

export function presetById(id: string): Preset | undefined {
  return PRESETS.find((p) => p.id === id);
}

export { GRANT_CLIENTS, INNOVATION_ROLES };
