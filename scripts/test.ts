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
import { tierFor, countTiers, sizeFit, finalRank, DEFAULT_THRESHOLDS, type TierInput } from '../lib/tiers';
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

console.log('\nTIERS');
const TARGET = ['executive_director', 'development_or_fundraising', 'founder_or_owner'];
const PREFERRED = ['nonprofit_or_charity', 'social_enterprise', 'startup_or_sme'];
const base = { targetRoles: TARGET, preferredIndustries: PREFERRED };

const emptyPositionRow: TierInput = {
  ...base, positionEmpty: true,
  answers: { disqualified: { type: 'noul', noul: 0.95 } },
};
check('an empty Position resolves to Tier 2, never Rejected',
  tierFor(emptyPositionRow, DEFAULT_THRESHOLDS) === 'tier2',
  tierFor(emptyPositionRow, DEFAULT_THRESHOLDS));

const strongRow: TierInput = {
  ...base, positionEmpty: false,
  answers: {
    role: {
      type: 'choice', choice: 'executive_director', confidence: 0.92,
      probabilities: { executive_director: 0.92 },
    },
    disqualified: { type: 'noul', noul: 0.02 },
    is_big_public_brand: { type: 'noul', noul: 0.1 },
    likely_private_or_family: { type: 'noul', noul: 0.8 },
  },
};
check('a confident target role with no disqualifier is Tier 1',
  tierFor(strongRow, DEFAULT_THRESHOLDS) === 'tier1');

const recruiterRow: TierInput = {
  ...base, positionEmpty: false,
  answers: {
    role: { type: 'choice', choice: 'not_executive', confidence: 0.9, probabilities: {} },
    disqualified: { type: 'noul', noul: 0.88 },
  },
};
check('a clear disqualifier is Rejected', tierFor(recruiterRow, DEFAULT_THRESHOLDS) === 'rejected');

const rows = [emptyPositionRow, strongRow, recruiterRow];
const before = countTiers(rows, DEFAULT_THRESHOLDS);
const after = countTiers(rows, { ...DEFAULT_THRESHOLDS, roleConfidenceTier1: 0.95 });
check('moving a threshold re-tiers from stored answers with no Jev call',
  before.tier1 === 1 && after.tier1 === 0,
  `tier1 ${before.tier1} -> ${after.tier1}`);

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
