/**
 * The default question set, derived from lib/icp.config.ts.
 *
 * Every question here is editable in the Classifier Studio; this file is only
 * the starting point. Two rules shaped all of it:
 *
 *   1. Jev reads meaning, never facts it cannot see. A LinkedIn export contains
 *      a job title and a company name. It does not contain a location, a
 *      headcount or a revenue figure, so no question below asks for one.
 *   2. Every escape option says, in the instructions, when to choose it. An
 *      "unknown" nobody is told to use is an option that never gets picked, and
 *      a model forced to guess produces confident nonsense.
 */

import { ICP } from './icp.config';
import type { QuestionSpec } from './spec/types';

const roleOptions = ICP.targetRoles.map((r) => ({
  name: r.id,
  criterion:
    `The title names this role or its plain equivalent: ${r.label}. ` +
    `Abbreviations, non-English titles and "acting" or "interim" forms all count. ` +
    `A deputy or assistant to this role does not.`,
}));

const industryOptions = ICP.preferredIndustries.map((i) => ({
  name: i.id,
  criterion:
    `The company name or the title indicates ${i.label.toLowerCase()}. ` +
    `Judge from the words themselves; do not reason from what you may happen to ` +
    `know about a company with a similar name.`,
}));

export const DEFAULT_QUESTIONS: QuestionSpec[] = [
  // --- CONNECTIONS -------------------------------------------------------
  {
    id: 'role',
    tab: 'connections',
    type: 'choice',
    enabled: true,
    fields: ['position', 'company', 'name_suffixes'],
    instructions:
      `You are reading one row of somebody's own LinkedIn connections export. ` +
      `All you have is the job title they had when you connected, the company ` +
      `name, and sometimes letters after their surname.\n\n` +
      `What is this person's role?\n\n` +
      `Choose "unknown" when \`position\` is empty, or when it says something ` +
      `that carries no seniority at all — a bare company name, a slogan, ` +
      `"Open to work", a single word like "Professional". Choosing "unknown" ` +
      `is correct and useful here; guessing a seniority from an empty field is not.`,
    options: [
      ...roleOptions,
      {
        name: 'other_executive',
        criterion:
          `A senior leadership title that is not one of the target roles above: ` +
          `a C-suite title of another kind, an EVP, SVP or VP, a Partner, a ` +
          `General Manager, an Executive Director.`,
      },
      {
        name: 'not_executive',
        criterion:
          `A real, readable title that is plainly below the leadership line: an ` +
          `individual contributor, a coordinator, an analyst, a student, an ` +
          `intern, a manager of a single function without a seniority marker.`,
      },
      {
        name: 'unknown',
        criterion:
          `\`position\` is empty, or its text says nothing about seniority. ` +
          `Prefer this over inferring a level from the company name alone.`,
      },
    ],
  },
  {
    id: 'company_type',
    tab: 'connections',
    type: 'choice',
    enabled: true,
    fields: ['company', 'position'],
    instructions:
      `What kind of business does this company name suggest?\n\n` +
      `Judge from the company name and the title text only. You have no ` +
      `industry code, no website and no description. Do not reason from ` +
      `outside knowledge about a real company that shares this name, because ` +
      `the name in an export is often abbreviated, misspelled or a local ` +
      `subsidiary.\n\n` +
      `Choose "unclear" when the name carries no industry signal at all — an ` +
      `initialism, a surname on its own, an invented word, or an empty field. ` +
      `"unclear" is the right answer far more often than it feels like it is.`,
    options: [
      ...industryOptions,
      {
        name: 'professional_services',
        criterion: `Law, accounting, consulting, architecture, engineering practice, agency.`,
      },
      {
        name: 'tech_or_software',
        criterion: `Software, SaaS, IT services, or a name built from a technology word.`,
      },
      { name: 'finance', criterion: `Banking, insurance, investment, lending, private equity.` },
      { name: 'healthcare', criterion: `Clinical care, medical devices, pharmaceuticals, health services.` },
      {
        name: 'large_educational_institution',
        criterion:
          `A university, college, large school board or research institute. ` +
          `Kept separate from nonprofits on purpose: this ICP wants nonprofits ` +
          `and does not want big educational institutions, so folding them ` +
          `together would hide the distinction that matters most.`,
      },
      {
        name: 'government_or_public_body',
        criterion: `A municipality, provincial or federal department, agency, or public authority.`,
      },
      {
        name: 'other',
        criterion:
          `The name clearly indicates an industry, but not one listed above — ` +
          `retail, hospitality, agriculture, media, real estate.`,
      },
      {
        name: 'unclear',
        criterion:
          `The company field is empty, or the name gives no industry signal: ` +
          `initials, a bare surname, a coined word.`,
      },
    ],
  },
  {
    id: 'likely_private_or_family',
    tab: 'connections',
    type: 'noul',
    enabled: true,
    fields: ['company'],
    instructions:
      `The company name suggests a privately held or family-owned business ` +
      `rather than a well-known public corporation.`,
    whenTrue:
      `The name reads as closely held: a surname, "& Sons", "& Daughters", ` +
      `"Group", "Holdings", "Enterprises", a family or place name joined to a ` +
      `trade, or a regional name attached to a specific line of work.`,
    whenFalse:
      `The name is a widely recognised listed corporation, a household brand, ` +
      `a government body, or a national institution. Also false when the ` +
      `company field is empty: absence is not evidence of a family business.`,
  },
  {
    id: 'is_big_public_brand',
    tab: 'connections',
    type: 'noul',
    enabled: true,
    fields: ['company'],
    instructions: `The company is a well-known large public corporation.`,
    whenTrue:
      `A household-name listed company that most people in business would ` +
      `recognise without explanation.`,
    whenFalse:
      `Anything smaller, regional, private, unrecognisable, or an empty field. ` +
      `An unfamiliar name is not a large corporation; it is an unfamiliar name.`,
  },
  {
    id: 'disqualified',
    tab: 'connections',
    type: 'noul',
    enabled: true,
    fields: ['position', 'company'],
    instructions:
      `The position and company text show this person belongs to one of the ` +
      `organizations this ICP rules out:\n` +
      ICP.disqualifiers.map((d) => `  - ${d}`).join('\n'),
    whenTrue:
      `The company is a household-name multinational, or a university, college ` +
      `or large school board. Judge from the words in front of you.`,
    whenFalse:
      `The organization is none of those, or there is nothing to read. An ` +
      `empty \`position\` or \`company\` is never grounds for disqualification — ` +
      `there is nothing there to judge. A small local business, a charity, a ` +
      `single school or a community group is not disqualified.`,
  },

  // --- INVITATIONS -------------------------------------------------------
  {
    id: 'message_intent',
    tab: 'invitations',
    type: 'choice',
    enabled: true,
    fields: ['name', 'message', 'invitation_age'],
    instructions:
      `Someone sent this connection invitation with a note attached. What do ` +
      `they want?\n\n` +
      `Judge the note's own words. A polite opening does not make a sales ` +
      `pitch into networking, and brevity does not make a genuine note into spam.`,
    options: [
      {
        name: 'genuine_networking',
        criterion:
          `They want to connect as peers: a shared industry, a shared event, a ` +
          `mutual contact, an interest in the recipient's work, with nothing ` +
          `being sold and nothing being asked for.`,
      },
      {
        name: 'wants_to_sell_me_something',
        criterion:
          `The note pitches a product or service, offers an audit, a demo, a ` +
          `call or a free trial, or names a result they can deliver. Its purpose ` +
          `is a commercial conversation, however warmly it opens.`,
      },
      {
        name: 'wants_a_job_or_mentoring',
        criterion:
          `They are asking for work, an introduction, advice, mentorship or ` +
          `time. The benefit flows towards the sender.`,
      },
      {
        name: 'fan_or_learner',
        criterion:
          `They admire something the recipient made or said and want to follow ` +
          `it, with no ask attached.`,
      },
      {
        name: 'spam_or_bot',
        criterion:
          `Mass-sent or automated: unrelated to the recipient, full of capitals ` +
          `or emoji, promising prizes or followers, or plainly machine-generated.`,
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
      `Read only what the note states, plus any credentials in their name. You ` +
      `do not have their profile, their title or their company. Choose ` +
      `"not_stated" whenever the note does not say — which is most of the time. ` +
      `Do not infer seniority from confident writing, good grammar, or the fact ` +
      `that they mention a company.`,
    options: [
      {
        name: 'c_level_or_owner',
        criterion: `They state a C-suite title, that they own or founded the business, or that they run it.`,
      },
      { name: 'director_or_vp', criterion: `They state a director, VP, partner or head-of-function role.` },
      { name: 'manager_or_ic', criterion: `They state a manager or individual contributor role.` },
      {
        name: 'student_or_junior',
        criterion: `They state that they are a student, graduate, intern or early in their career.`,
      },
      {
        name: 'not_stated',
        criterion: `The note says nothing about their level. This is the common case.`,
      },
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
    whenTrue: `The location or country field places them there.`,
    whenFalse: `It places them elsewhere, or there is no location to read.`,
  },
  {
    id: 'organization_scale',
    tab: 'enriched',
    type: 'score',
    enabled: true,
    fields: ['company_size', 'industry', 'current_company'],
    instructions:
      `How large is this organization? Judge from headcount and what the ` +
      `company appears to do.\n\n` +
      `This is a plain size scale, not a pass mark. ${ICP.sizeGuidance} So the ` +
      `ranking treats the middle of this scale as the best fit and both ends as ` +
      `worse, rather than rewarding "bigger". Choose the middle level when the ` +
      `size field is missing, rather than assuming small.`,
    levels: [
      'Very small: a handful of people, or a volunteer-run group.',
      'Small: roughly 10 to 50 people.',
      'Medium, or the size is not stated.',
      'Large: several hundred people, operating across a region.',
      'Very large: thousands of people, national or multinational.',
    ],
  },
  {
    id: 'family_business',
    tab: 'enriched',
    type: 'noul',
    enabled: true,
    fields: ['current_company', 'industry', 'headline'],
    instructions: `This is a family-owned or closely held business rather than a widely held corporation.`,
    whenTrue: `The company's name, description or the person's own headline indicates family or founder ownership.`,
    whenFalse: `It is publicly traded, institutionally owned, or a government or nonprofit body.`,
  },
  {
    id: 'decision_maker',
    tab: 'enriched',
    type: 'noul',
    enabled: true,
    fields: ['headline', 'current_company', 'company_size'],
    instructions:
      `This person could approve an engagement of the size this ICP implies ` +
      `without needing someone above them to sign it off.`,
    whenTrue:
      `Their role carries budget authority at this size of company: owner, ` +
      `C-suite, or a functional head at a company small enough that they hold ` +
      `the budget.`,
    whenFalse:
      `They would need approval from above, or their role has no budget at all.`,
  },
  {
    id: 'active_on_linkedin',
    tab: 'enriched',
    type: 'choice',
    enabled: true,
    fields: ['last_activity', 'follower_count'],
    instructions:
      `How recently has this person posted?\n\n` +
      `Read the activity fields only. Choose "unknown" when no activity field ` +
      `came back from enrichment — a missing field means the data is absent, ` +
      `not that the person is dormant.`,
    options: [
      { name: 'posted_in_last_30_days', criterion: `An activity date within the last 30 days.` },
      { name: 'posted_in_last_6_months', criterion: `An activity date within the last six months.` },
      { name: 'dormant', criterion: `An activity date older than six months.` },
      { name: 'unknown', criterion: `No activity field was returned.` },
    ],
  },
];
