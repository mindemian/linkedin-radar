/**
 * THE TWO ICPs. One file.
 *
 * Mina is running two different searches over the same LinkedIn network, and
 * they want opposite things from the same person. A funder is a great contact
 * for the job search and a non-customer for the client search; a small charity
 * with no fundraiser is the reverse. Keeping them as one ICP would make every
 * tier mean two things at once, so they are two presets and you switch between
 * them in the app.
 *
 * Editing your targeting is an edit to this file. Re-run `npm run build`
 * afterwards: the contract check validates every shipped preset.
 */

// ---------------------------------------------------------------------------
// 1. GRANT CLIENTS — the default
// ---------------------------------------------------------------------------

export const GRANT_CLIENTS_ICP = {
  company:
    'Project-based grant writing for organizations that need grants and do not have ' +
    'the in-house capacity to write them.',

  /**
   * Mina asked for "grant writing required" — a need, not a title. These are
   * the titles that evidence that need, because a Position field can show a
   * title and cannot show a need.
   *
   * The ordering matters. `development_or_fundraising` is a target, but holding
   * that title proves the organization already has fundraising capacity, which
   * is the thing Mina is selling. So it ranks below a small-shop executive
   * director who has nobody.
   */
  primeRoles: ['executive_director', 'founder_or_owner', 'program_or_operations_lead'],
  secondaryRoles: ['development_or_fundraising', 'board_or_volunteer_fundraiser'],

  geography: 'Calgary first, then Alberta, then the rest of Canada, then the United States.',

  companyProfile:
    'Nonprofits and registered charities of any size, smaller preferred. Community ' +
    'groups, social enterprises and arts organizations. Startups and small businesses ' +
    'going after innovation or startup grants.',

  sizeGuidance:
    'For nonprofits, smaller is a better fit — they are the ones without a fundraising ' +
    'department. For businesses, large enough to deliver a funded project but not a ' +
    'multinational.',

  /**
   * An allowlist, not a blocklist. Mina: "everyone else should be disqualified."
   * The gate is `organization_seeks_grants`; anything failing it is Rejected.
   * These two are named because they are the common false positives.
   */
  neverTier1: [
    'large multinational corporations',
    'big educational institutions such as universities and large school boards',
    'funders and grantmakers — worth talking to, but a separate conversation',
  ],
} as const;

export const PRIME_ROLE_IDS = GRANT_CLIENTS_ICP.primeRoles as readonly string[];
export const SECONDARY_ROLE_IDS = GRANT_CLIENTS_ICP.secondaryRoles as readonly string[];

// ---------------------------------------------------------------------------
// 2. INNOVATION ROLES — Mina's own job search
// ---------------------------------------------------------------------------

export const INNOVATION_ROLES_ICP = {
  goal:
    'A full-time Director of Innovation or equivalent: director or executive-director ' +
    'level, with an innovation, ecosystem or strategy mandate.',

  geography: 'Calgary first, then Alberta, then the rest of Canada, then remote-friendly roles elsewhere.',

  /** Who is worth a conversation. Not customers — people near hiring decisions. */
  whoMatters:
    'People who run innovation mandates, ecosystem and accelerator leaders, economic ' +
    'development officers, and senior people at organizations that hire for this kind ' +
    'of role. Recruiters count here, unlike in the client search.',
} as const;

export const SENIOR_BUCKETS = ['c_level_or_owner', 'director_or_vp'] as const;

export function grantClientsIcpText(): string {
  const i = GRANT_CLIENTS_ICP;
  return [
    `What I sell: ${i.company}`,
    `Prime roles: ${i.primeRoles.join(', ')}`,
    `Secondary roles (already have fundraising capacity): ${i.secondaryRoles.join(', ')}`,
    `Geography: ${i.geography}`,
    `Organizations: ${i.companyProfile}`,
    `Size: ${i.sizeGuidance}`,
    `Never Tier 1: ${i.neverTier1.join('; ')}`,
    `Everyone not at a plausible grant-seeking organization is Rejected.`,
  ].join('\n');
}

export function innovationRolesIcpText(): string {
  const i = INNOVATION_ROLES_ICP;
  return [`Goal: ${i.goal}`, `Geography: ${i.geography}`, `Who matters: ${i.whoMatters}`].join('\n');
}
