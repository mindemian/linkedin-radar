/**
 * Tier maths, in code. Every function here reads only stored answers, so moving
 * a threshold slider re-tiers the whole set instantly and calls Jev zero times.
 * That property is the reason answers are stored with their full distribution.
 */

import type { Answer, Thresholds } from './spec/types';

export const DEFAULT_THRESHOLDS: Thresholds = {
  roleConfidenceTier1: 0.7,
  roleConfidenceTier2: 0.5,
  disqualifiedMax: 0.3,
  disqualifiedReject: 0.7,
  bigPublicBrandMax: 0.5,
  privateFamilyMin: 0.6,
  sellingToMeMax: 0.7,
  spamMax: 0.7,
};

export type ConnectionTier = 'tier1' | 'tier2' | 'tier3' | 'rejected';
export type InvitationBucket = 'accept' | 'review' | 'ignore' | 'no_signal';

function choiceOf(a: Answer | undefined): { choice: string; confidence: number } | null {
  return a && a.type === 'choice' ? { choice: a.choice, confidence: a.confidence } : null;
}
function noulOf(a: Answer | undefined): number {
  return a && a.type === 'noul' ? a.noul : 0;
}

export type TierInput = {
  answers: Record<string, Answer>;
  /** Rows with no Position resolve to "unknown" and must never be Rejected. */
  positionEmpty: boolean;
  /** Option names counted as target roles, from the ICP. */
  targetRoles: readonly string[];
  /** Option names counted as preferred industries, from the ICP. */
  preferredIndustries: readonly string[];
};

export function tierFor(input: TierInput, t: Thresholds): ConnectionTier {
  const { answers, positionEmpty, targetRoles, preferredIndustries } = input;
  const role = choiceOf(answers.role);
  const companyType = choiceOf(answers.company_type);
  const disqualified = noulOf(answers.disqualified);
  const bigBrand = noulOf(answers.is_big_public_brand);
  const privateFamily = noulOf(answers.likely_private_or_family);

  // An empty Position cannot support a rejection: there is nothing there to
  // disqualify. Spec requires these land in Tier 2.
  if (positionEmpty) return 'tier2';

  if (disqualified >= t.disqualifiedReject) return 'rejected';

  const isTargetRole = role !== null && targetRoles.includes(role.choice);

  if (
    isTargetRole &&
    role.confidence >= t.roleConfidenceTier1 &&
    disqualified < t.disqualifiedMax &&
    bigBrand < t.bigPublicBrandMax
  ) {
    return 'tier1';
  }

  const midConfidenceTarget =
    isTargetRole && role.confidence >= t.roleConfidenceTier2 && role.confidence < t.roleConfidenceTier1;
  const unknownRoleGoodIndustry =
    role?.choice === 'unknown' && companyType !== null && preferredIndustries.includes(companyType.choice);
  const anyExecutive =
    role !== null && role.choice !== 'not_executive' && role.choice !== 'unknown';
  const familyBusinessExec = privateFamily >= t.privateFamilyMin && anyExecutive;

  if (midConfidenceTarget || unknownRoleGoodIndustry || familyBusinessExec) return 'tier2';

  return 'tier3';
}

export function invitationBucketFor(
  answers: Record<string, Answer> | undefined,
  hasMessage: boolean,
  seniorBuckets: readonly string[],
  t: Thresholds,
): InvitationBucket {
  if (!hasMessage || !answers) return 'no_signal';

  const intent = choiceOf(answers.message_intent);
  const seniority = choiceOf(answers.self_described_seniority);
  if (!intent) return 'review';

  const p = (answers.message_intent as Extract<Answer, { type: 'choice' }>).probabilities ?? {};
  const spam = p['spam_or_bot'] ?? 0;
  const selling = p['wants_to_sell_me_something'] ?? 0;
  if (spam >= t.spamMax || selling >= t.sellingToMeMax) return 'ignore';

  const goodIntent = intent.choice === 'genuine_networking' || intent.choice === 'fan_or_learner';
  const senior = seniority !== null && seniorBuckets.includes(seniority.choice);
  if (goodIntent && senior) return 'accept';

  return 'review';
}

/**
 * Final ranking after enrichment: geography first, then decision-maker times
 * size fit.
 *
 * Size is read as a BAND, not a ceiling. This ICP sells grant writing: a
 * nonprofit is a better fit the smaller it is, and a business needs enough
 * scale to deliver a funded project but must not be a multinational. So the
 * middle of the five-level scale scores 1 and both ends score 0. Treating the
 * scale as "bigger is better" would rank exactly the multinationals the ICP
 * disqualifies straight to the top.
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
  // Geography leads, then the product of the two continuous signals.
  return inGeo * 10 + decisionMaker * fit;
}

export function countTiers(
  rows: TierInput[],
  t: Thresholds,
): Record<ConnectionTier, number> {
  const counts: Record<ConnectionTier, number> = { tier1: 0, tier2: 0, tier3: 0, rejected: 0 };
  for (const r of rows) counts[tierFor(r, t)] += 1;
  return counts;
}
