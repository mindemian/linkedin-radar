/**
 * Tier maths, in code. Every function here reads only stored answers, so moving
 * a threshold slider re-tiers the whole set instantly and calls Jev zero times.
 * That property is why answers are stored with their full distribution.
 *
 * Each preset scores for a different thing, so each brings its own tier
 * function. Thresholds are an open record rather than a fixed shape, and every
 * read carries a fallback, so a preset that omits a key still works.
 */

import type { Answer, Thresholds } from './spec/types';
import { PRIME_ROLE_NAMES, SECONDARY_ROLE_NAMES } from './presets/grant-clients';

export type ConnectionTier = 'tier1' | 'tier2' | 'tier3' | 'funder' | 'rejected';
export type InvitationBucket = 'accept' | 'review' | 'ignore' | 'no_signal';

/** Organization types this ICP rules out regardless of how grant-hungry they are. */
export const EXCLUDED_COMPANY_TYPES = ['large_educational_institution'];

export const BUCKET_LABELS: Record<InvitationBucket, string> = {
  accept: 'Accept',
  review: 'Review',
  ignore: 'Ignore',
  no_signal: 'No signal',
};

/** Seniority options that count as senior. Both presets share the scale. */
export const SENIOR_BUCKETS = ['c_level_or_owner', 'director_or_vp'] as const;

/**
 * Which stated intents are worth accepting, per preset. Grant clients want to
 * hear from someone with a funding problem; the job search wants to hear about
 * an opening. Neither wants a pitch.
 */
const GOOD_INTENTS: Record<string, readonly string[]> = {
  'grant-clients': ['genuine_networking', 'needs_grant_help', 'fan_or_learner'],
  'innovation-roles': ['genuine_networking', 'offering_opportunity', 'fan_or_learner'],
};

export const TIER_LABELS: Record<ConnectionTier, string> = {
  tier1: 'Tier 1',
  tier2: 'Tier 2',
  tier3: 'Tier 3',
  funder: 'Funder',
  rejected: 'Rejected',
};

function choiceOf(a: Answer | undefined): { choice: string; confidence: number } | null {
  return a && a.type === 'choice' ? { choice: a.choice, confidence: a.confidence } : null;
}
function noulOf(a: Answer | undefined, fallback = 0): number {
  return a && a.type === 'noul' ? a.noul : fallback;
}
function probs(a: Answer | undefined): Record<string, number> {
  return a && a.type === 'choice' ? a.probabilities : {};
}
const t = (th: Thresholds, key: string, fallback: number) => th[key] ?? fallback;

export type TierInput = {
  answers: Record<string, Answer>;
  /** Rows with no Position resolve to "unknown" and must never be Rejected. */
  positionEmpty: boolean;
};

/**
 * GRANT CLIENTS.
 *
 * Order matters more than usual here. Funders are checked first because a
 * grantmaking foundation looks exactly like a nonprofit on every other signal —
 * that was the actual failure in the first live run, where United Way scored
 * Tier 1. And the rejection is an allowlist: anything that is not plausibly a
 * grant-seeking organization is out, rather than only the two categories named
 * explicitly.
 */
export function grantClientsTier(input: TierInput, th: Thresholds): ConnectionTier {
  const { answers, positionEmpty } = input;
  const role = choiceOf(answers.role);
  const seeks = noulOf(answers.organization_seeks_grants, 0.5);
  const inhouse = noulOf(answers.has_inhouse_fundraising);

  // 1. Funders are set aside before anything else can claim them.
  if (role?.choice === 'funder_or_grantmaker' && role.confidence >= t(th, 'funderConfidenceMin', 0.6)) {
    return 'funder';
  }

  // 2. An empty Position outranks the rejection: there is no evidence in a
  //    blank field to reject on. Required by the brief, and correct.
  if (positionEmpty) return 'tier2';

  // 3. Policy exclusions, applied in code rather than by leaning on the model.
  //    A university genuinely does seek grants — asking Jev to say otherwise
  //    would mean asking it to be wrong about the world, and an answer that has
  //    to lie in one place cannot be trusted in another. So the honest answer
  //    stands and this ICP's exclusion is enforced here instead.
  const type = choiceOf(answers.company_type);
  if (type && EXCLUDED_COMPANY_TYPES.includes(type.choice) &&
      type.confidence >= t(th, 'excludedTypeConfidence', 0.6)) {
    return 'rejected';
  }

  // 4. The allowlist gate.
  if (seeks < t(th, 'seeksGrantsMin', 0.5)) return 'rejected';

  const isPrime = role !== null && PRIME_ROLE_NAMES.includes(role.choice);
  const isSecondary = role !== null && SECONDARY_ROLE_NAMES.includes(role.choice);

  // 5. Tier 1 wants a prime role at a grant-seeker with nobody in-house.
  if (
    isPrime &&
    role.confidence >= t(th, 'roleConfidenceTier1', 0.7) &&
    inhouse < t(th, 'inhouseFundraisingMax', 0.5)
  ) {
    return 'tier1';
  }

  // 6. Tier 2 catches the harder-but-real conversations.
  const midConfidencePrime = isPrime && role.confidence >= t(th, 'roleConfidenceTier2', 0.5);
  const primeWithCapacity = isPrime && inhouse >= t(th, 'inhouseFundraisingMax', 0.5);
  const unknownAtGrantSeeker = role?.choice === 'unknown';
  if (isSecondary || midConfidencePrime || primeWithCapacity || unknownAtGrantSeeker) return 'tier2';

  return 'tier3';
}

/**
 * INNOVATION ROLES. Ranks by proximity to a hiring decision rather than by
 * grant-seeking fit, so a funder or a recruiter scores well here and a tiny
 * charity does not — the mirror image of the preset above.
 */
export function innovationRolesTier(input: TierInput, th: Thresholds): ConnectionTier {
  const { answers, positionEmpty } = input;
  const role = choiceOf(answers.role);
  const couldHire = noulOf(answers.could_hire_or_refer, 0.5);
  const runsPrograms = noulOf(answers.organization_runs_innovation_programs, 0.5);

  if (positionEmpty) return 'tier2';
  if (couldHire < t(th, 'notRelevantReject', 0.25)) return 'rejected';

  const strongRole =
    role !== null &&
    ['innovation_leader', 'ecosystem_or_accelerator', 'economic_development'].includes(role.choice) &&
    role.confidence >= t(th, 'roleConfidenceTier1', 0.7);

  if (strongRole && couldHire >= t(th, 'couldHireMin', 0.6)) return 'tier1';
  if (
    couldHire >= t(th, 'couldHireMin', 0.6) ||
    runsPrograms >= t(th, 'runsProgramsMin', 0.5) ||
    role?.choice === 'unknown'
  ) {
    return 'tier2';
  }
  return 'tier3';
}

export function tierFor(presetId: string, input: TierInput, th: Thresholds): ConnectionTier {
  return presetId === 'innovation-roles'
    ? innovationRolesTier(input, th)
    : grantClientsTier(input, th);
}

export function invitationBucketFor(
  answers: Record<string, Answer> | undefined,
  hasMessage: boolean,
  seniorBuckets: readonly string[],
  th: Thresholds,
  /** Intent options that are worth accepting for this preset. */
  goodIntents: readonly string[] = ['genuine_networking', 'fan_or_learner', 'needs_grant_help'],
): InvitationBucket {
  if (!hasMessage || !answers) return 'no_signal';
  const intent = choiceOf(answers.message_intent);
  if (!intent) return 'review';

  const p = probs(answers.message_intent);
  if ((p.spam_or_bot ?? 0) >= t(th, 'spamMax', 0.7)) return 'ignore';
  if ((p.wants_to_sell_me_something ?? 0) >= t(th, 'sellingToMeMax', 0.7)) return 'ignore';

  const seniority = choiceOf(answers.self_described_seniority);
  const senior = seniority !== null && seniorBuckets.includes(seniority.choice);

  // Someone who names a funding problem, or names an opening, is worth reading
  // whatever they say about their own seniority.
  if (intent.choice === 'needs_grant_help' || intent.choice === 'offering_opportunity') return 'accept';
  if (goodIntents.includes(intent.choice) && senior) return 'accept';

  return 'review';
}

/**
 * Size is read as a BAND, not a ceiling. This ICP wants small nonprofits and
 * mid-sized businesses; ranking on "bigger is better" would put the
 * multinationals the ICP rejects at the top.
 */
export function sizeFit(score: number, levels = 5): number {
  const middle = (levels - 1) / 2;
  return 1 - Math.abs(score - middle) / middle;
}

export function finalRank(answers: Record<string, Answer>): number {
  const decisionMaker = noulOf(answers.decision_maker);
  const scale = answers.organization_scale;
  const fit = scale && scale.type === 'score' ? sizeFit(scale.score) : 0.5;
  const inGeo = noulOf(answers.in_geography);
  return inGeo * 10 + decisionMaker * fit;
}

export function countTiers(
  presetId: string,
  rows: TierInput[],
  th: Thresholds,
): Record<ConnectionTier, number> {
  const counts: Record<ConnectionTier, number> = {
    tier1: 0, tier2: 0, tier3: 0, funder: 0, rejected: 0,
  };
  for (const r of rows) counts[tierFor(presetId, r, th)] += 1;
  return counts;
}

/**
 * Preset-aware wrapper over invitationBucketFor, so the screen never has to
 * know which intent names a preset happens to use.
 */
export function bucketFor(
  presetId: string,
  answers: Record<string, Answer> | undefined,
  hasMessage: boolean,
  th: Thresholds,
): InvitationBucket {
  return invitationBucketFor(
    answers,
    hasMessage,
    SENIOR_BUCKETS,
    th,
    GOOD_INTENTS[presetId] ?? GOOD_INTENTS['grant-clients'],
  );
}
