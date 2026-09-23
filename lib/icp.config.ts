/**
 * THE ICP. One file. Every default question's options and criteria are derived
 * from what is written here, so changing your targeting is an edit to this file
 * and nothing else. Re-run `npm run build` afterwards: the contract check
 * confirms the derived questions still hold.
 */

export const ICP = {
  company: 'Grant writing services for nonprofits, charities and grant-seeking businesses.',

  /**
   * Mina's answer was "grant writing required" — a need, not a list of titles.
   * These are the titles that signal that need, which is what a LinkedIn
   * Position field can actually show.
   */
  targetRoles: [
    { id: 'executive_director', label: 'Executive Director or nonprofit CEO' },
    { id: 'development_or_fundraising', label: 'Development, fundraising or advancement lead' },
    { id: 'founder_or_owner', label: 'Founder or owner of a grant-seeking business' },
    { id: 'program_or_operations_lead', label: 'Program or operations lead at a nonprofit' },
    { id: 'grants_or_funding_role', label: 'Grants or funding role' },
  ],

  geography: 'Calgary first, then Alberta, then the rest of Canada, then the United States.',

  /**
   * Nonprofits and big educational institutions sit on opposite sides of this
   * ICP, so they are separate options in `company_type`. Folding them together,
   * as the generic version does, would make the single most important
   * distinction in this list unscoreable.
   */
  preferredIndustries: [
    { id: 'nonprofit_or_charity', label: 'Nonprofit, charity or foundation' },
    { id: 'social_enterprise', label: 'Social enterprise or community organization' },
    { id: 'startup_or_sme', label: 'Startup or small-to-medium business seeking grants' },
    { id: 'health_or_social_services', label: 'Health, social services or housing' },
    { id: 'arts_culture_or_recreation', label: 'Arts, culture, sport or recreation' },
  ],

  companyProfile:
    'Nonprofits and registered charities of any size, smaller ones preferred. ' +
    'Medium to large businesses when the fit is startup or innovation grants.',

  /**
   * Not a simple ceiling. A nonprofit is a better fit the smaller it is; a
   * business needs enough scale to run a funded project. The `organization_scale`
   * question reads as a band, not a threshold — see questions.defaults.ts.
   */
  sizeGuidance:
    'For nonprofits, smaller is a better fit. For businesses, large enough to ' +
    'deliver a funded project but not a multinational.',

  disqualifiers: [
    'large multinational corporations',
    'big educational institutions such as universities and large school boards',
  ],
} as const;

export const TARGET_ROLE_IDS = ICP.targetRoles.map((r) => r.id);
export const PREFERRED_INDUSTRY_IDS = ICP.preferredIndustries.map((i) => i.id);
export const SENIOR_BUCKETS = ['c_level_or_owner', 'director_or_vp'] as const;

export function icpAsText(): string {
  return [
    `Company: ${ICP.company}`,
    `Target roles: ${ICP.targetRoles.map((r) => r.label).join('; ')}`,
    `Geography: ${ICP.geography}`,
    `Company profile: ${ICP.companyProfile}`,
    `Size guidance: ${ICP.sizeGuidance}`,
    `Disqualifiers: ${ICP.disqualifiers.join('; ')}`,
  ].join('\n');
}

export function isPlaceholder(): boolean {
  return icpAsText().includes('PLACEHOLDER');
}
