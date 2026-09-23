/**
 * THE FIELD CONTRACT.
 *
 * Jev judges meaning, and only from the fields listed here. Everything countable
 * — dates, matching, direction, tiers, totals — is computed in code and never
 * asked of the model.
 *
 * Enforced in three places, all reading this file:
 *   1. build      scripts/check-contract.ts fails the build on a violation
 *   2. studio     field checkboxes are built from the upload's real columns
 *   3. route      /api/score re-validates every spec it receives
 */

export type Tab = 'connections' | 'invitations' | 'enriched';

/** What Jev may read, per tab, before enrichment. */
export const CONTRACT: Record<Tab, readonly string[]> = {
  connections: ['position', 'company', 'name_suffixes', 'connected_for'],
  invitations: ['name', 'message', 'invitation_age'],
  // Second pass only. These exist solely because enrichment supplied them.
  enriched: [
    'location', 'country', 'headline', 'current_company', 'company_size',
    'industry', 'last_activity', 'follower_count',
  ],
};

/**
 * Never inferable from a LinkedIn export. Naming one of these in a
 * pre-enrichment question is a build error, not a warning: the model would be
 * guessing, and a confident guess is worse here than no answer.
 */
export const FORBIDDEN_PRE_ENRICHMENT = [
  'location', 'country', 'company_size', 'industry', 'industry_code', 'revenue',
  'photo', 'headline', 'activity', 'last_activity', 'mutual_connections',
  'follower_count', 'connections_count',
] as const;

/** Computed in code. Listed so the Methods page can show what Jev never sees. */
export const CODE_OWNED = [
  'has_email', 'all date arithmetic', 'direction (INCOMING / OUTGOING)',
  'accepted / pending matching', 'all counting', 'all tier math',
] as const;

export function allowedFields(tab: Tab): readonly string[] {
  return CONTRACT[tab];
}

export function isAllowed(tab: Tab, field: string): boolean {
  return CONTRACT[tab].includes(field);
}

/** A pre-enrichment question may not name a forbidden field, whatever the tab. */
export function forbiddenIn(tab: Tab, field: string): boolean {
  if (tab === 'enriched') return false;
  return (FORBIDDEN_PRE_ENRICHMENT as readonly string[]).includes(field);
}
