/**
 * THE GRANT CLIENTS PRESET — the default.
 *
 * Finds organizations that need grants written and lack the in-house capacity
 * to write them. Every question is editable in the Classifier Studio; this is
 * only the starting point.
 *
 * Two rules shaped all of it:
 *   1. Jev reads meaning, never facts it cannot see. A LinkedIn export holds a
 *      job title and a company name. No question here asks for a location, a
 *      headcount or a revenue figure, because none of those are in the file.
 *   2. Every escape option says, in the instructions, when to choose it. An
 *      "unknown" nobody is told to use never gets picked, and a model forced to
 *      guess produces confident nonsense.
 */

import { GRANT_CLIENTS_ICP as ICP, grantClientsIcpText } from '../icp.config';
import type { Preset, QuestionSpec, Slider } from '../spec/types';

const PRIME = [
  {
    name: 'executive_director',
    criterion:
      `Executive Director, Executive Officer, or the chief executive of a nonprofit, ` +
      `charity, community group or arts organization, however it is phrased. In a small ` +
      `organization this person often is the entire fundraising function, which is exactly ` +
      `the situation this ICP looks for.`,
  },
  {
    name: 'founder_or_owner',
    criterion:
      `Founder, co-founder, owner or proprietor of a business or social enterprise. ` +
      `Includes early-stage company founders, who apply for innovation and startup grants.`,
  },
  {
    name: 'program_or_operations_lead',
    criterion:
      `Program Director, Director of Operations, or a similar senior operating role inside ` +
      `a nonprofit or community organization: close enough to both the work and the budget ` +
      `to commission a grant application.`,
  },
];

const SECONDARY = [
  {
    name: 'development_or_fundraising',
    criterion:
      `Development, fundraising, advancement or philanthropy in the title — Director of ` +
      `Development, Fundraising Manager, Advancement Officer. Note what this title proves: ` +
      `the organization already employs somebody to raise money.`,
  },
  {
    name: 'board_or_volunteer_fundraiser',
    criterion:
      `A board member, chair, trustee, or a volunteer fundraising role. Often the person ` +
      `carrying fundraising at an organization too small to employ anyone for it.`,
  },
];

export const PRIME_ROLE_NAMES = PRIME.map((o) => o.name);
export const SECONDARY_ROLE_NAMES = SECONDARY.map((o) => o.name);

const QUESTIONS: QuestionSpec[] = [
  {
    id: 'role',
    tab: 'connections',
    type: 'choice',
    enabled: true,
    fields: ['position', 'company', 'name_suffixes'],
    instructions:
      `You are reading one row of somebody's own LinkedIn connections export. All you ` +
      `have is the job title this person held when the connection was made, the company ` +
      `name, and sometimes letters after their surname.\n\n` +
      `What is this person's role?\n\n` +
      `Choose "unknown" when \`position\` is empty, or when its text carries no seniority ` +
      `at all — a bare company name, a slogan, "Open to work", a single word like ` +
      `"Professional". Choosing "unknown" is correct and useful here. Inferring a ` +
      `seniority from an empty field is not.`,
    options: [
      ...PRIME,
      ...SECONDARY,
      {
        name: 'funder_or_grantmaker',
        criterion:
          `This person works at an organization that GIVES money away rather than one ` +
          `that applies for it: a grantmaking foundation, a United Way, a community ` +
          `foundation, a government funding program, a corporate giving office. Titles ` +
          `like Program Officer, Grants Manager or Director of Community Investment at ` +
          `such an organization belong here.\n\n` +
          `Read the direction of the money, not the vocabulary. "Grants" in a title ` +
          `means the opposite thing on the funder's side of the table than it does on ` +
          `the applicant's, and mistaking one for the other is the single most likely ` +
          `error in this question.`,
      },
      {
        name: 'other_executive',
        criterion:
          `A senior leadership title that is none of the above: a C-suite title of another ` +
          `kind, EVP, SVP or VP, Partner, General Manager.`,
      },
      {
        name: 'not_executive',
        criterion:
          `A real, readable title plainly below the leadership line: an individual ` +
          `contributor, coordinator, analyst, student, intern, or a manager of a single ` +
          `function with no seniority marker.`,
      },
      {
        name: 'unknown',
        criterion:
          `\`position\` is empty, or its text says nothing about seniority. Prefer this ` +
          `over inferring a level from the company name alone.`,
      },
    ],
  },

  /**
   * The gate. Everything hinges on this one answer, so its criteria carry more
   * weight than anything else in the file: a false negative here silently
   * deletes a real customer from the list.
   */
  {
    id: 'organization_seeks_grants',
    tab: 'connections',
    type: 'noul',
    enabled: true,
    fields: ['company', 'position'],
    instructions:
      `This organization is the kind that applies for grants.\n\n` +
      `Not whether it needs money, and not whether it would win one. Whether writing ` +
      `grant applications is a normal part of how an organization like this is funded.`,
    whenTrue:
      `A nonprofit, registered charity, foundation-funded programme, community group, ` +
      `association, arts or culture organization, sports club, housing or social services ` +
      `provider, Indigenous organization, or a research-stage or early-stage business of ` +
      `the kind that applies for innovation, research or startup funding. A single school, ` +
      `clinic or shelter belongs here. So does a company whose name suggests cleantech, ` +
      `biotech, medtech or agritech, because those sectors are grant-funded as a matter of ` +
      `course.`,
    whenFalse:
      `A professional services firm selling to businesses — law, accounting, consulting, ` +
      `staffing, recruitment, marketing agencies. Retail, hospitality, real estate, ` +
      `personal services, or an established profitable business with no research or ` +
      `social mission. A large multinational corporation. Also false when the company ` +
      `field is empty and the title gives no hint: absence is not evidence of a ` +
      `grant-seeker.\n\n` +
      `Note what is NOT listed here. Universities and large school boards apply for ` +
      `grants constantly, so the honest answer for them is true. This ICP excludes them ` +
      `anyway, but that is a policy about who Mina wants to work with, and the code ` +
      `applies it from \`company_type\`. Do not distort this answer to serve it: an ` +
      `answer that has to lie about the world is one that cannot be trusted anywhere else.`,
  },

  /**
   * The capacity signal. This is the difference between a warm conversation and
   * a hard one, so it gets its own question rather than being folded into role.
   */
  {
    id: 'has_inhouse_fundraising',
    tab: 'connections',
    type: 'noul',
    enabled: true,
    fields: ['position', 'company'],
    instructions:
      `This row is evidence that the organization already employs dedicated fundraising ` +
      `or development staff.`,
    whenTrue:
      `The person's own title is a fundraising, development, advancement, philanthropy or ` +
      `grants role. Somebody holding that title is the in-house capacity.`,
    whenFalse:
      `The title is something else entirely, or there is no title to read. An executive ` +
      `director, a founder, a program lead or a board member gives you no reason to think ` +
      `anyone is employed to raise money — in a small organization, usually nobody is.`,
  },

  {
    id: 'company_type',
    tab: 'connections',
    type: 'choice',
    enabled: true,
    fields: ['company', 'position'],
    instructions:
      `What kind of organization does this company name suggest?\n\n` +
      `Judge from the company name and the title text only. You have no industry code, ` +
      `no website and no description. Do not reason from outside knowledge about a real ` +
      `company sharing this name: names in an export are often abbreviated, misspelled, ` +
      `or a local subsidiary of something much larger.\n\n` +
      `Choose "unclear" when the name carries no signal at all — an initialism, a surname ` +
      `on its own, an invented word, or an empty field. "unclear" is the right answer far ` +
      `more often than it feels like it is.`,
    options: [
      {
        name: 'nonprofit_or_charity',
        criterion: `A nonprofit, registered charity, society, association or community foundation.`,
      },
      {
        name: 'social_enterprise',
        criterion: `A business with an explicit social or environmental mission, or a co-operative.`,
      },
      {
        name: 'startup_or_sme',
        criterion:
          `A small or early-stage business, especially one whose name suggests research or ` +
          `technology development: cleantech, biotech, medtech, agritech, "Labs", "Ventures".`,
      },
      {
        name: 'health_or_social_services',
        criterion: `Health care, mental health, housing, shelter, food security or social services.`,
      },
      {
        name: 'arts_culture_or_recreation',
        criterion: `Arts, culture, heritage, museums, festivals, sport or recreation.`,
      },
      {
        name: 'funder_or_foundation',
        criterion:
          `An organization whose purpose is to give money away: a grantmaking foundation, ` +
          `a United Way, a government funding agency, a corporate giving programme.`,
      },
      {
        name: 'large_educational_institution',
        criterion:
          `A university, college, polytechnic, large school board or research institute. ` +
          `Kept separate from nonprofits deliberately: this ICP wants nonprofits and does ` +
          `not want big educational institutions, so folding them together would hide the ` +
          `distinction that matters most in this list.`,
      },
      {
        name: 'government_or_public_body',
        criterion: `A municipality, a provincial or federal department, an agency or public authority.`,
      },
      {
        name: 'professional_services',
        criterion: `Law, accounting, consulting, recruitment, staffing, marketing or an agency.`,
      },
      {
        name: 'corporate_or_commercial',
        criterion:
          `An established commercial business with no visible research or social mission: ` +
          `retail, hospitality, manufacturing, finance, real estate, logistics.`,
      },
      {
        name: 'unclear',
        criterion: `The company field is empty, or the name gives no signal: initials, a bare surname, a coined word.`,
      },
    ],
  },

  {
    id: 'is_big_public_brand',
    tab: 'connections',
    type: 'noul',
    enabled: true,
    fields: ['company'],
    instructions: `The company is a well-known large public corporation or multinational.`,
    whenTrue: `A household-name listed company most people in business would recognise without explanation.`,
    whenFalse:
      `Anything smaller, regional, private, unrecognisable, or an empty field. An ` +
      `unfamiliar name is not a large corporation; it is an unfamiliar name.`,
  },

  // --- INVITATIONS -------------------------------------------------------
  {
    id: 'message_intent',
    tab: 'invitations',
    type: 'choice',
    enabled: true,
    fields: ['name', 'message', 'invitation_age'],
    instructions:
      `Someone sent this connection invitation with a note attached. What do they want?\n\n` +
      `Judge the note's own words. A polite opening does not turn a sales pitch into ` +
      `networking, and brevity does not turn a genuine note into spam.`,
    options: [
      {
        name: 'genuine_networking',
        criterion:
          `They want to connect as peers: a shared sector, a shared event, a mutual ` +
          `contact, an interest in the recipient's work. Nothing sold, nothing asked for.`,
      },
      {
        name: 'wants_to_sell_me_something',
        criterion:
          `The note pitches a product or service, offers an audit, a demo, a call or a ` +
          `free trial, or names a result they can deliver. Its purpose is a commercial ` +
          `conversation, however warmly it opens.`,
      },
      {
        name: 'wants_a_job_or_mentoring',
        criterion: `They are asking for work, an introduction, advice or time. The benefit flows to the sender.`,
      },
      {
        name: 'needs_grant_help',
        criterion:
          `They mention funding, grants, fundraising, a campaign or a project they are ` +
          `trying to finance. The most valuable note in the inbox for this ICP, so read ` +
          `for it specifically.`,
      },
      { name: 'fan_or_learner', criterion: `They admire something the recipient made or said, with no ask attached.` },
      {
        name: 'spam_or_bot',
        criterion:
          `Mass-sent or automated: unrelated to the recipient, full of capitals or emoji, ` +
          `promising prizes or followers, or plainly machine-generated.`,
      },
    ],
  },
  {
    id: 'self_described_seniority',
    tab: 'invitations',
    type: 'choice',
    enabled: true,
    fields: ['name', 'message'],
    instructions:
      `How senior does this person say they are?\n\n` +
      `Read only what the note states, plus any credentials in their name. You do not have ` +
      `their profile, their title or their company. Choose "not_stated" whenever the note ` +
      `does not say, which is most of the time. Do not infer seniority from confident ` +
      `writing, good grammar, or the fact that they mention a company.`,
    options: [
      { name: 'c_level_or_owner', criterion: `They state a C-suite title, or that they own, founded or run the organization.` },
      { name: 'director_or_vp', criterion: `They state a director, VP, partner or head-of-function role.` },
      { name: 'manager_or_ic', criterion: `They state a manager or individual contributor role.` },
      { name: 'student_or_junior', criterion: `They state that they are a student, graduate, intern or early in their career.` },
      { name: 'not_stated', criterion: `The note says nothing about their level. This is the common case.` },
    ],
  },

  // --- SECOND PASS, AFTER ENRICHMENT -------------------------------------
  {
    id: 'in_geography',
    tab: 'enriched',
    type: 'noul',
    enabled: true,
    fields: ['location', 'country'],
    instructions: `This person is located in the ICP's preferred geography: ${ICP.geography}`,
    whenTrue: `The location or country field places them there. Calgary is the strongest match, then elsewhere in Alberta, then Canada, then the United States.`,
    whenFalse: `It places them outside those, or there is no location to read.`,
  },
  {
    id: 'organization_scale',
    tab: 'enriched',
    type: 'score',
    enabled: true,
    fields: ['company_size', 'industry', 'current_company'],
    instructions:
      `How large is this organization? Judge from headcount and what it appears to do.\n\n` +
      `This is a plain size scale, not a pass mark. ${ICP.sizeGuidance} The ranking treats ` +
      `the middle of this scale as the best fit and both ends as worse, rather than ` +
      `rewarding "bigger". Choose the middle level when the size field is missing, rather ` +
      `than assuming small.`,
    levels: [
      'Very small: a handful of people, or a volunteer-run group.',
      'Small: roughly 10 to 50 people.',
      'Medium, or the size is not stated.',
      'Large: several hundred people, operating across a region.',
      'Very large: thousands of people, national or multinational.',
    ],
  },
  {
    id: 'decision_maker',
    tab: 'enriched',
    type: 'noul',
    enabled: true,
    fields: ['headline', 'current_company', 'company_size'],
    instructions:
      `This person could commission a grant writer without needing someone above them to ` +
      `sign it off.`,
    whenTrue:
      `Their role carries budget authority at this size of organization: an executive ` +
      `director, a founder or owner, a C-suite role, or a functional head at an ` +
      `organization small enough that they hold the budget themselves.`,
    whenFalse: `They would need approval from above, or their role carries no budget at all.`,
  },
  {
    id: 'active_on_linkedin',
    tab: 'enriched',
    type: 'choice',
    enabled: true,
    fields: ['last_activity', 'follower_count'],
    instructions:
      `How recently has this person posted?\n\n` +
      `Read the activity fields only. Choose "unknown" when no activity field came back ` +
      `from enrichment — a missing field means the data is absent, not that the person is ` +
      `dormant.`,
    options: [
      { name: 'posted_in_last_30_days', criterion: `An activity date within the last 30 days.` },
      { name: 'posted_in_last_6_months', criterion: `An activity date within the last six months.` },
      { name: 'dormant', criterion: `An activity date older than six months.` },
      { name: 'unknown', criterion: `No activity field was returned.` },
    ],
  },
];

export const GRANT_CLIENTS_SLIDERS: Slider[] = [
  {
    key: 'seeksGrantsMin', label: 'Grant-seeker floor', min: 0, max: 1, step: 0.05,
    explains: 'Below this, the organization is treated as not a grant-seeker and the row is Rejected.',
  },
  {
    key: 'excludedTypeConfidence', label: 'Excluded-type confidence', min: 0, max: 1, step: 0.05,
    explains: 'How sure the model must be that an organization is a university or large school board before the row is Rejected.',
  },
  {
    key: 'roleConfidenceTier1', label: 'Tier 1 role confidence', min: 0, max: 1, step: 0.05,
    explains: 'How sure the role has to be before a prime role reaches Tier 1.',
  },
  {
    key: 'roleConfidenceTier2', label: 'Tier 2 role confidence', min: 0, max: 1, step: 0.05,
    explains: 'Below the Tier 1 bar but above this, a prime role still reaches Tier 2.',
  },
  {
    key: 'inhouseFundraisingMax', label: 'In-house fundraising ceiling', min: 0, max: 1, step: 0.05,
    explains: 'Above this, the organization looks like it already employs a fundraiser, so the row drops to Tier 2.',
  },
  {
    key: 'funderConfidenceMin', label: 'Funder confidence', min: 0, max: 1, step: 0.05,
    explains: 'How sure the model has to be before a row is set aside as a funder rather than a client.',
  },
  {
    key: 'spamMax', label: 'Spam ceiling', min: 0, max: 1, step: 0.05,
    explains: 'Invitations above this on spam or selling are moved to Ignore.',
  },
];

export const GRANT_CLIENTS: Preset = {
  id: 'grant-clients',
  name: 'Grant clients',
  purpose: 'Organizations that need grants written and have nobody in-house to write them.',
  icp: grantClientsIcpText(),
  questions: QUESTIONS,
  thresholds: {
    seeksGrantsMin: 0.5,
    excludedTypeConfidence: 0.6,
    roleConfidenceTier1: 0.7,
    roleConfidenceTier2: 0.5,
    inhouseFundraisingMax: 0.5,
    funderConfidenceMin: 0.6,
    spamMax: 0.7,
    sellingToMeMax: 0.7,
  },
  sliders: GRANT_CLIENTS_SLIDERS,
};
