/**
 * The verification list from the brief, as runnable checks. Everything here is
 * a pure function, so it runs without touching Jev and without a network.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { identify, expectedColumnsMessage } from '../lib/parse/detect';
import { parseConnections } from '../lib/parse/connections';
import {
  joinWithConnections, noSignalInvitations, parseInvitations, scorableInvitations,
} from '../lib/parse/invitations';
import { normalizeProfileUrl } from '../lib/parse/urls';
import { parseConnectedOn, parseSentAt } from '../lib/parse/dates';
import { validateQuestions, hasBlockingError } from '../lib/spec/validate';
import { tierFor, countTiers, sizeFit, finalRank, type TierInput } from '../lib/tiers';
import { GRANT_CLIENTS, INNOVATION_ROLES, PRESETS } from '../lib/presets';
import { questionHash, hashAll, staleness, describeStaleness } from '../lib/spec/hash';
import { fork, forkName, isBuiltIn, importJson, exportJson } from '../lib/presets/fork';
import type { QuestionSpec } from '../lib/spec/types';

let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean, detail = '') => {
  if (ok) { pass += 1; console.log(`  PASS  ${name}`); }
  else { fail += 1; console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
};

const F = (n: string) => readFileSync(resolve(process.cwd(), 'fixtures', n), 'utf8');
const connText = F('Connections.csv');
const invText = F('Invitations.csv');
const wrongText = F('NotALinkedInExport.csv');

console.log('\nPARSING');
const conn = parseConnections(connText)!;
const inv = parseInvitations(invText)!;

check('the Notes: preamble is skipped', conn.rows.length > 0 && conn.rows[0].firstName !== '');
check('parsed count matches raw line count',
  conn.rows.length === conn.rawLines, `${conn.rows.length} vs ${conn.rawLines}`);
check('invitations parsed count matches raw line count',
  inv.rows.length === inv.rawLines, `${inv.rows.length} vs ${inv.rawLines}`);
check('the Connections date format parses',
  conn.unparsedDates === 0 && !!parseConnectedOn('18 Sep 2026'), `${conn.unparsedDates} unparsed`);
check('the Invitations date format parses',
  inv.unparsedDates === 0 && !!parseSentAt('9/18/26, 1:20 AM'), `${inv.unparsedDates} unparsed`);
check('the detected formats are reported',
  conn.dateFormat.includes('18 Sep') && inv.dateFormat.includes('9/18/26'));
check('credentials are split into name_suffixes',
  conn.rows.some((r) => r.name_suffixes));
check('empty Position and Company rows are counted',
  conn.emptyPosition > 0 && conn.emptyCompany > 0);
check('invitations without a message are counted', inv.withoutMessage > 0);

console.log('\nFILE IDENTIFICATION');
check('a Connections file is identified by its header', identify(connText) === 'connections');
check('an Invitations file is identified by its header', identify(invText) === 'invitations');
check('a file dropped in the wrong slot is still identified, so it can be moved',
  identify(invText) === 'invitations' && identify(connText) === 'connections');
check('a file matching neither schema is rejected', identify(wrongText) === 'unknown');
check('the rejection names the expected columns',
  expectedColumnsMessage().includes('Connected On') &&
  expectedColumnsMessage().includes('inviteeProfileUrl'));

console.log('\nURL NORMALIZATION AND THE JOIN');
const variants = [
  'https://www.linkedin.com/in/jane-doe-100/',
  'http://linkedin.com/in/Jane-Doe-100',
  'https://ca.linkedin.com/in/jane-doe-100?originalSubdomain=ca',
  'https://www.linkedin.com/in/jane-doe-100/#foo',
];
check('all four URL spellings normalize to one key',
  new Set(variants.map(normalizeProfileUrl)).size === 1,
  [...new Set(variants.map(normalizeProfileUrl))].join(' | '));

const keys = new Set(conn.rows.map((r) => r.urlKey));
const joined = joinWithConnections(inv.rows, keys);
check('outgoing invitations match against Connections',
  joined.accepted > 0, `${joined.accepted} accepted`);
check('incoming invitations resolve to pending or accepted',
  joined.pending > 0, `${joined.pending} pending`);
check('an outgoing invitee not in Connections stays "sent"',
  joined.rows.some((r) => r.direction === 'OUTGOING' && r.status === 'sent'));

console.log('\nWHAT REACHES JEV');
const scorable = scorableInvitations(inv.rows);
const noSignal = noSignalInvitations(inv.rows);
check('message-less invitations never reach Jev',
  scorable.every((r) => r.message.trim() !== ''));
check('outgoing invitations never reach Jev',
  scorable.every((r) => r.direction === 'INCOMING'));
check('message-less incoming rows land in No signal', noSignal.length > 0);
check('No signal is sorted by recency',
  noSignal.every((r, i) =>
    i === 0 || (noSignal[i - 1].sentAt?.getTime() ?? 0) >= (r.sentAt?.getTime() ?? 0)));

console.log('\nTIERS — GRANT CLIENTS');
const TH = GRANT_CLIENTS.thresholds;
const GC = GRANT_CLIENTS.id;
const noul = (n: number) => ({ type: 'noul' as const, noul: n });
const pick = (choice: string, confidence: number) => ({
  type: 'choice' as const, choice, confidence, probabilities: { [choice]: confidence },
});

// The exact failure from the first live run: United Way scored Tier 1 because a
// grantmaker looks like a nonprofit on every other signal.
const funder: TierInput = {
  positionEmpty: false,
  answers: {
    role: pick('funder_or_grantmaker', 0.95),
    organization_seeks_grants: noul(0.9),
    has_inhouse_fundraising: noul(0.4),
  },
};
check('a funder is set aside, not scored as a client',
  tierFor(GC, funder, TH) === 'funder', tierFor(GC, funder, TH));

const smallCharityED: TierInput = {
  positionEmpty: false,
  answers: {
    role: pick('executive_director', 0.93),
    organization_seeks_grants: noul(0.92),
    has_inhouse_fundraising: noul(0.05),
  },
};
check('an executive director at a grant-seeker with nobody in-house is Tier 1',
  tierFor(GC, smallCharityED, TH) === 'tier1', tierFor(GC, smallCharityED, TH));

const sameButStaffed: TierInput = {
  ...smallCharityED,
  answers: { ...smallCharityED.answers, has_inhouse_fundraising: noul(0.85) },
};
check('the same row drops to Tier 2 once in-house fundraising is evident',
  tierFor(GC, sameButStaffed, TH) === 'tier2', tierFor(GC, sameButStaffed, TH));

const devDirector: TierInput = {
  positionEmpty: false,
  answers: {
    role: pick('development_or_fundraising', 0.95),
    organization_seeks_grants: noul(0.9),
    has_inhouse_fundraising: noul(0.9),
  },
};
check('a development director is Tier 2, not Tier 1',
  tierFor(GC, devDirector, TH) === 'tier2', tierFor(GC, devDirector, TH));

const recruiter: TierInput = {
  positionEmpty: false,
  answers: {
    role: pick('not_executive', 0.9),
    organization_seeks_grants: noul(0.05),
    has_inhouse_fundraising: noul(0.1),
  },
};
check('an organization that does not seek grants is Rejected',
  tierFor(GC, recruiter, TH) === 'rejected', tierFor(GC, recruiter, TH));

const blankAtMultinational: TierInput = {
  positionEmpty: true,
  answers: { organization_seeks_grants: noul(0.02), is_big_public_brand: noul(0.98) },
};
check('an empty Position is Tier 2 even when the company would otherwise reject',
  tierFor(GC, blankAtMultinational, TH) === 'tier2', tierFor(GC, blankAtMultinational, TH));

const rows = [funder, smallCharityED, devDirector, recruiter, blankAtMultinational];
const before = countTiers(GC, rows, TH);
const after = countTiers(GC, rows, { ...TH, roleConfidenceTier1: 0.99 });
check('moving a threshold re-tiers from stored answers with no Jev call',
  before.tier1 === 1 && after.tier1 === 0, `tier1 ${before.tier1} -> ${after.tier1}`);
check('counts cover every tier including funder',
  Object.keys(before).length === 5 && before.funder === 1);

console.log('\nTIERS — INNOVATION ROLES (the mirror image)');
const IR = INNOVATION_ROLES.id;
const ITH = INNOVATION_ROLES.thresholds;
const innovationDirector: TierInput = {
  positionEmpty: false,
  answers: {
    role: pick('innovation_leader', 0.95),
    could_hire_or_refer: noul(0.85),
    organization_runs_innovation_programs: noul(0.9),
  },
};
check('an innovation director is Tier 1 in the job-search preset',
  tierFor(IR, innovationDirector, ITH) === 'tier1', tierFor(IR, innovationDirector, ITH));
check('the same person is NOT Tier 1 in the client preset',
  tierFor(GC, innovationDirector, TH) !== 'tier1', tierFor(GC, innovationDirector, TH));

const recruiterForJobs: TierInput = {
  positionEmpty: false,
  answers: {
    role: pick('talent_or_recruiter', 0.92),
    could_hire_or_refer: noul(0.8),
    organization_runs_innovation_programs: noul(0.3),
  },
};
check('a recruiter is a target in the job search but rejected as a client',
  tierFor(IR, recruiterForJobs, ITH) === 'tier2' && tierFor(GC, recruiter, TH) === 'rejected');

console.log('\nPRESETS');
check('both presets ship', PRESETS.length === 2);
check('every preset passes its own validator',
  PRESETS.every((p) => !hasBlockingError(validateQuestions(p.questions))));
check('every preset declares a slider for each threshold it uses',
  PRESETS.every((p) => p.sliders.every((sl) => sl.key in p.thresholds)));

console.log('\nSIZE IS A BAND, NOT A CEILING');
check('a mid-sized organization fits best', sizeFit(2) === 1);
check('a very large organization fits worst', sizeFit(4) === 0);
check('a very small organization fits worst too', sizeFit(0) === 0);
const multinational = {
  in_geography: { type: 'noul', noul: 0.95 },
  decision_maker: { type: 'noul', noul: 0.95 },
  organization_scale: { type: 'score', score: 4, confidence: 0.9, probabilities: {} },
} as Record<string, import('../lib/spec/types').Answer>;
const midsizeCharity = {
  in_geography: { type: 'noul', noul: 0.95 },
  decision_maker: { type: 'noul', noul: 0.95 },
  organization_scale: { type: 'score', score: 2, confidence: 0.9, probabilities: {} },
} as Record<string, import('../lib/spec/types').Answer>;
check('a multinational does not outrank a mid-sized charity',
  finalRank(midsizeCharity) > finalRank(multinational),
  `charity ${finalRank(midsizeCharity).toFixed(2)} vs multinational ${finalRank(multinational).toFixed(2)}`);

console.log('\nQUESTION VERSIONING');
const baseQ = GRANT_CLIENTS.questions.find((q) => q.id === 'organization_seeks_grants')!;
const h0 = questionHash(baseQ);

check('the same question hashes the same twice', questionHash({ ...baseQ }) === h0);
check('rewording the instructions changes the hash',
  questionHash({ ...baseQ, instructions: baseQ.instructions + ' Also consider X.' }) !== h0);
check('changing the fields changes the hash',
  questionHash({ ...baseQ, fields: ['company'] }) !== h0);
check('disabling a question does NOT change its hash',
  questionHash({ ...baseQ, enabled: false }) === h0,
  'a spurious stale warning teaches people to ignore the warning');
check('reordering the field list does NOT change the hash',
  questionHash({ ...baseQ, fields: [...baseQ.fields].reverse() }) === h0);

const choiceQ = GRANT_CLIENTS.questions.find((q) => q.id === 'role')!;
if (choiceQ.type === 'choice') {
  const edited = {
    ...choiceQ,
    options: choiceQ.options.map((o, i) => (i === 0 ? { ...o, criterion: o.criterion + ' Plus.' } : o)),
  };
  check('editing one option criterion changes the hash', questionHash(edited) !== questionHash(choiceQ));
}

const liveQs = GRANT_CLIENTS.questions.filter((q) => q.tab === 'connections');
const currentHashes = hashAll(liveQs);
const scoredRows: Record<string, { questionHashes?: Record<string, string> }> = {};
for (let i = 0; i < 400; i++) scoredRows[`c${i}`] = { questionHashes: { ...currentHashes } };

const fresh = staleness(scoredRows, liveQs);
check('nothing is stale when nothing changed', fresh.staleRows === 0 && describeStaleness(fresh) === null);

// Reword one question, as the Studio would.
const rewordedQs = liveQs.map((q) =>
  q.id === 'organization_seeks_grants' ? { ...q, instructions: q.instructions + ' Extra.' } : q);
const stale = staleness(scoredRows, rewordedQs);
check('every row scored under the old wording is counted stale',
  stale.byQuestion.organization_seeks_grants === 400 && stale.staleRows === 400,
  `${stale.byQuestion.organization_seeks_grants} counted`);
check('only the edited question is stale', Object.keys(stale.byQuestion).length === 1);
const msg = describeStaleness(stale) ?? '';
check('the warning names the question and the count in plain English',
  msg.includes('400 of 400') && msg.includes('organization seeks grants') && msg.includes('Re-run'),
  msg.slice(0, 80));

// A row that never answered the question is unscored, not stale.
const partial = { c0: { questionHashes: {} } };
check('a row that never answered a question is not counted stale',
  staleness(partial, rewordedQs).staleRows === 0);

console.log('\nPRESET FORKING AND IMPORT');
const forked = fork(GRANT_CLIENTS, [...PRESETS]);
check('a fork gets a new id and name', forked.id !== GRANT_CLIENTS.id && forked.name.includes('edited'));
if (forked.questions[0].type === 'choice' && GRANT_CLIENTS.questions[0].type === 'choice') {
  forked.questions[0].options[0].criterion = 'MUTATED';
  check('editing a fork does not touch the shipped preset',
    GRANT_CLIENTS.questions[0].options[0].criterion !== 'MUTATED');
}
forked.thresholds.seeksGrantsMin = 0.99;
check('fork thresholds are independent', GRANT_CLIENTS.thresholds.seeksGrantsMin !== 0.99);
check('two forks of the same preset do not collide',
  forkName(GRANT_CLIENTS, [...PRESETS, forked]).id !== forked.id);
check('shipped presets are recognised as built-in',
  isBuiltIn(GRANT_CLIENTS.id) && !isBuiltIn(forked.id));

const roundTrip = importJson(exportJson(INNOVATION_ROLES), [...PRESETS]);
check('a preset survives export and re-import', roundTrip.ok);
check('re-importing a shipped preset forks it rather than replacing it',
  roundTrip.ok && roundTrip.preset.id !== INNOVATION_ROLES.id);

check('invalid JSON is refused', !importJson('{not json', []).ok);
check('a file with no questions is refused', !importJson('{"name":"x"}', []).ok);

const badPreset = JSON.stringify({
  id: 'evil', name: 'Evil', questions: [{
    id: 'sneaky', tab: 'connections', type: 'noul', enabled: true,
    fields: ['country'], instructions: 'Where do they live?',
  }],
});
const rejected = importJson(badPreset, []);
check('an imported preset naming an out-of-contract field is refused',
  !rejected.ok && (rejected as any).errors?.length > 0,
  rejected.ok ? 'accepted!' : (rejected as any).errors?.[0]?.message?.slice(0, 60));

console.log('\nSPEC VALIDATION');
const good: QuestionSpec = {
  id: 'role', tab: 'connections', type: 'choice', enabled: true,
  fields: ['position', 'company'],
  instructions: 'What is this person\'s role? Choose "unknown" when Position is empty or too vague.',
  options: [
    { name: 'coo', criterion: 'Chief Operating Officer or equivalent.' },
    { name: 'unknown', criterion: 'Position is empty or says nothing about seniority.' },
  ],
};
check('a valid question passes', !hasBlockingError(validateQuestions([good])));

const outOfContract = { ...good, id: 'bad', fields: ['position', 'country'] } as QuestionSpec;
check('a question naming a forbidden field is rejected',
  hasBlockingError(validateQuestions([outOfContract])));

const oneOption = { ...good, id: 'one', options: [good.options[0]] } as QuestionSpec;
check('a choice with one option is rejected', hasBlockingError(validateQuestions([oneOption])));

const noCriterion = {
  ...good, id: 'nc',
  options: [{ name: 'a', criterion: '' }, { name: 'b', criterion: 'b' }],
} as QuestionSpec;
check('an option with no criterion is rejected', hasBlockingError(validateQuestions([noCriterion])));

const noFields = { ...good, id: 'nf', fields: [] } as QuestionSpec;
check('a question reading no fields is rejected', hasBlockingError(validateQuestions([noFields])));

const elevenLevels: QuestionSpec = {
  id: 'rev', tab: 'enriched', type: 'score', enabled: true, fields: ['company_size'],
  instructions: 'Revenue.', levels: Array.from({ length: 11 }, (_, i) => `level ${i}`),
};
check('a score with more than ten levels is rejected',
  hasBlockingError(validateQuestions([elevenLevels])));

const dupes = validateQuestions([good, { ...good }]);
check('two questions sharing an id is rejected', hasBlockingError(dupes));

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
