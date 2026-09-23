/**
 * THE INNOVATION ROLES PRESET — Mina's own job search.
 *
 * Same uploaded files, same contract fields, opposite question. This preset
 * does not ask "could this person buy grant writing?" It asks "could this
 * person hire me into a Director of Innovation role, or introduce me to
 * someone who can?"
 *
 * Notice what flips. A funder is a non-customer in the client preset and a
 * strong contact here. A recruiter is Rejected there and a target here. A tiny
 * charity with no fundraiser is prime there and irrelevant here. Which is why
 * these are two presets and not one set of questions trying to serve both.
 */

import { INNOVATION_ROLES_ICP as ICP, innovationRolesIcpText } from '../icp.config';
import type { Preset, QuestionSpec, Slider } from '../spec/types';

const QUESTIONS: QuestionSpec[] = [
  {
    id: 'role',
    tab: 'connections',
    type: 'choice',
    enabled: true,
    fields: ['position', 'company', 'name_suffixes'],
    instructions:
      `You are reading one row of somebody's LinkedIn connections. The reader is looking ` +
      `for a full-time role: ${ICP.goal}\n\n` +
      `What is this person's role, judged by how close it sits to that kind of hiring ` +
      `decision?\n\n` +
      `Choose "unknown" when \`position\` is empty or says nothing about what the person ` +
      `does. Do not guess a function from the company name alone.`,
    options: [
      {
        name: 'innovation_leader',
        criterion:
          `Innovation, R&D, transformation, strategy or new ventures in the title — ` +
          `Director of Innovation, Chief Innovation Officer, Head of Strategy, VP ` +
          `Transformation. The person who holds the mandate being sought, and therefore ` +
          `either the future peer, the future boss, or the incumbent.`,
      },
      {
        name: 'ecosystem_or_accelerator',
        criterion:
          `Runs or works senior at an accelerator, incubator, innovation hub, startup ` +
          `support organization or industry cluster. These organizations both hire for ` +
          `this mandate and know everyone else who does.`,
      },
      {
        name: 'economic_development',
        criterion:
          `Economic development, investment attraction, trade or regional development, at ` +
          `a municipality, province, chamber of commerce or development corporation.`,
      },
      {
        name: 'funder_or_grantmaker',
        criterion:
          `A foundation, granting agency, United Way or corporate giving programme. Worth ` +
          `noting that this is a strong contact here and a non-customer in the grant ` +
          `clients preset: the same person, scored for a different purpose.`,
      },
      {
        name: 'talent_or_recruiter',
        criterion:
          `Recruitment, talent acquisition, executive search or HR leadership. A target ` +
          `for a job search, unlike in the client preset where the same title is rejected.`,
      },
      {
        name: 'senior_executive',
        criterion:
          `A C-suite, president, executive director or owner title, without an explicit ` +
          `innovation mandate. Hires at this level or knows who does.`,
      },
      {
        name: 'not_relevant',
        criterion: `A readable title with no plausible connection to innovation hiring.`,
      },
      { name: 'unknown', criterion: `\`position\` is empty, or its text says nothing about what they do.` },
    ],
  },
  {
    id: 'organization_runs_innovation_programs',
    tab: 'connections',
    type: 'noul',
    enabled: true,
    fields: ['company', 'position'],
    instructions:
      `This organization plausibly runs innovation, research, startup or economic ` +
      `development programmes — the kind of place that employs a Director of Innovation.`,
    whenTrue:
      `An accelerator, incubator, innovation hub, research institute, university tech ` +
      `transfer office, economic development agency, industry cluster, granting body, or ` +
      `a large organization of the kind that runs an internal innovation function.`,
    whenFalse:
      `A small local business, a retailer, a single practice, or an organization with no ` +
      `visible research, startup or transformation activity. Also false when the company ` +
      `field is empty.`,
  },
  {
    id: 'could_hire_or_refer',
    tab: 'connections',
    type: 'noul',
    enabled: true,
    fields: ['position', 'company'],
    instructions:
      `This person sits close enough to innovation hiring to either make the decision or ` +
      `make the introduction.`,
    whenTrue:
      `They lead an innovation mandate, run an organization that has one, recruit for a ` +
      `living, or hold a senior enough title to open the door themselves.`,
    whenFalse:
      `They are junior, in an unrelated function, or at an organization that would never ` +
      `carry this mandate.`,
  },
  {
    id: 'seniority',
    tab: 'connections',
    type: 'choice',
    enabled: true,
    fields: ['position', 'name_suffixes'],
    instructions:
      `What level is this person, from the title alone? Choose "unknown" when the title ` +
      `is empty or carries no level.`,
    options: [
      { name: 'c_level_or_owner', criterion: `C-suite, president, executive director, founder or owner.` },
      { name: 'director_or_vp', criterion: `Director, VP, partner, or head of a function.` },
      { name: 'manager_or_ic', criterion: `Manager or individual contributor.` },
      { name: 'junior', criterion: `Student, intern, graduate or explicitly early-career.` },
      { name: 'unknown', criterion: `The title is empty or says nothing about level.` },
    ],
  },

  // --- INVITATIONS -------------------------------------------------------
  {
    id: 'message_intent',
    tab: 'invitations',
    type: 'choice',
    enabled: true,
    fields: ['name', 'message', 'invitation_age'],
    instructions: `Someone sent this invitation with a note. What do they want?`,
    options: [
      { name: 'genuine_networking', criterion: `Peer-to-peer connection, nothing sold, nothing asked.` },
      {
        name: 'offering_opportunity',
        criterion:
          `They mention a role, a mandate, a project or an opening. The most valuable ` +
          `note in the inbox for a job search, so read for it specifically.`,
      },
      { name: 'wants_to_sell_me_something', criterion: `A pitch: a product, a service, an audit, a demo, a call.` },
      { name: 'wants_a_job_or_mentoring', criterion: `They are asking the recipient for work, advice or time.` },
      { name: 'fan_or_learner', criterion: `Admiration for the recipient's work, with no ask.` },
      { name: 'spam_or_bot', criterion: `Mass-sent or automated, unrelated to the recipient.` },
    ],
  },
  {
    id: 'self_described_seniority',
    tab: 'invitations',
    type: 'choice',
    enabled: true,
    fields: ['name', 'message'],
    instructions:
      `How senior does this person say they are? Read only what the note states. Choose ` +
      `"not_stated" whenever it does not say, which is most of the time.`,
    options: [
      { name: 'c_level_or_owner', criterion: `They state a C-suite, founder or owner role.` },
      { name: 'director_or_vp', criterion: `They state a director, VP, partner or head-of-function role.` },
      { name: 'manager_or_ic', criterion: `They state a manager or individual contributor role.` },
      { name: 'student_or_junior', criterion: `They state that they are a student or early in their career.` },
      { name: 'not_stated', criterion: `The note says nothing about their level.` },
    ],
  },

  // --- SECOND PASS -------------------------------------------------------
  {
    id: 'in_geography',
    tab: 'enriched',
    type: 'noul',
    enabled: true,
    fields: ['location', 'country'],
    instructions: `This person is located in the preferred geography: ${ICP.geography}`,
    whenTrue: `The location places them there, Calgary strongest.`,
    whenFalse: `It places them outside those, or there is no location to read.`,
  },
  {
    id: 'decision_maker',
    tab: 'enriched',
    type: 'noul',
    enabled: true,
    fields: ['headline', 'current_company', 'company_size'],
    instructions: `This person could create or approve a senior innovation role, rather than only pass a CV along.`,
    whenTrue: `An executive, an owner, or the head of the function that would carry the mandate.`,
    whenFalse: `They could refer but not decide, or their role carries no such authority.`,
  },
  {
    id: 'active_on_linkedin',
    tab: 'enriched',
    type: 'choice',
    enabled: true,
    fields: ['last_activity', 'follower_count'],
    instructions:
      `How recently has this person posted? Read the activity fields only. Choose ` +
      `"unknown" when no activity field came back — absent data is not dormancy. This ` +
      `matters more here than in the client preset: an active person is far likelier to ` +
      `answer a message.`,
    options: [
      { name: 'posted_in_last_30_days', criterion: `An activity date within the last 30 days.` },
      { name: 'posted_in_last_6_months', criterion: `An activity date within the last six months.` },
      { name: 'dormant', criterion: `An activity date older than six months.` },
      { name: 'unknown', criterion: `No activity field was returned.` },
    ],
  },
];

export const INNOVATION_SLIDERS: Slider[] = [
  {
    key: 'couldHireMin', label: 'Hiring proximity floor', min: 0, max: 1, step: 0.05,
    explains: 'How close to a hiring decision someone must be to reach Tier 1.',
  },
  {
    key: 'roleConfidenceTier1', label: 'Tier 1 role confidence', min: 0, max: 1, step: 0.05,
    explains: 'How sure the role has to be before it reaches Tier 1.',
  },
  {
    key: 'runsProgramsMin', label: 'Innovation organization floor', min: 0, max: 1, step: 0.05,
    explains: 'How strongly the organization must look like one that runs innovation programmes.',
  },
  {
    key: 'notRelevantReject', label: 'Reject threshold', min: 0, max: 1, step: 0.05,
    explains: 'Below this on hiring proximity, the row is faded out as not relevant to the search.',
  },
  {
    key: 'spamMax', label: 'Spam ceiling', min: 0, max: 1, step: 0.05,
    explains: 'Invitations above this on spam or selling are moved to Ignore.',
  },
];

export const INNOVATION_ROLES: Preset = {
  id: 'innovation-roles',
  name: 'Innovation roles',
  purpose: 'People who could hire you into a Director of Innovation role, or introduce you to someone who can.',
  icp: innovationRolesIcpText(),
  questions: QUESTIONS,
  thresholds: {
    couldHireMin: 0.6,
    roleConfidenceTier1: 0.7,
    runsProgramsMin: 0.5,
    notRelevantReject: 0.25,
    spamMax: 0.7,
    sellingToMeMax: 0.7,
  },
  sliders: INNOVATION_SLIDERS,
};
