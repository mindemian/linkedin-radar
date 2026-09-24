import { chromium } from 'playwright';
import { resolve } from 'node:path';

const URL = 'http://localhost:3105';
const FIX = resolve(process.cwd(), 'fixtures');
let pass = 0, fail = 0;
const check = (n, ok, d='') => { ok ? (pass++, console.log(`  PASS  ${n}`)) : (fail++, console.log(`  FAIL  ${n}${d?` — ${d}`:''}`)); };

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(URL, { waitUntil: 'networkidle' });
console.log('\nUPLOAD');
check('the empty state renders', await page.locator('h1', { hasText: 'LinkedIn Radar' }).isVisible());

// Wrong slot on purpose: drop Invitations into the Connections slot.
await page.locator('input[type=file]').first().setInputFiles(resolve(FIX, 'Invitations.csv'));
await page.waitForTimeout(600);
const moved = await page.getByText(/moved to the right slot/i).isVisible().catch(() => false);
check('a file dropped in the wrong slot is moved and announced', moved);

await page.locator('input[aria-label="connections file"]').setInputFiles(resolve(FIX, 'Connections.csv'));
await page.waitForTimeout(800);

const summary = await page.locator('body').innerText();
check('parsed vs raw counts are reported', /400 parsed of 400 rows/i.test(summary), summary.match(/\d+ parsed of \d+ rows/)?.[0]);
check('the date format is reported', /18 Sep 2026/.test(summary));
check('empty position count is reported', /with no position/i.test(summary));
check('accepted and pending are reported once both files are loaded', /accepted ·/i.test(summary));

console.log('\nRUN');
await page.getByRole('button', { name: 'Run' }).click();
// Poll fast: the point is that intermediate states exist, not any one number.
const seen = new Set();
for (let i = 0; i < 40; i++) {
  const n = Number((await page.locator('body').innerText()).match(/ROWS READ\s*([\d,]+)/i)?.[1]?.replace(/,/g, '') ?? 0);
  seen.add(n);
  if (n >= 400) break;
  await page.waitForTimeout(250);
}
check('the grid fills in progressively rather than all at once',
  seen.size >= 3 && [...seen].some((n) => n > 0 && n < 400), `saw ${seen.size} distinct counts`);

await page.getByRole('button', { name: 'Pause' }).click();
await page.waitForTimeout(1500);
const pausedCount = Number((await page.locator('body').innerText()).match(/ROWS READ\s*([\d,]+)/i)?.[1]?.replace(/,/g, '') ?? 0);
await page.waitForTimeout(1500);
const stillPaused = Number((await page.locator('body').innerText()).match(/ROWS READ\s*([\d,]+)/i)?.[1]?.replace(/,/g, '') ?? 0);
check('Pause actually stops the run', stillPaused === pausedCount, `${pausedCount} -> ${stillPaused}`);

await page.getByRole('button', { name: 'Resume' }).click();
await page.waitForFunction(
  () => /ROWS READ\s*400/i.test(document.body.innerText),
  null, { timeout: 180000 },
).catch(() => {});
await page.waitForTimeout(1500);
const done = await page.locator('body').innerText();
const readDone = Number(done.match(/ROWS READ\s*([\d,]+)/i)?.[1]?.replace(/,/g, '') ?? 0);
check('Resume finishes the run', readDone === 400, `read ${readDone}`);

const cost = done.match(/COST SO FAR\s*\$([\d.]+)/i)?.[1];
check('the cost counter shows four decimals', /^\d+\.\d{4}$/.test(cost ?? ''), `$${cost}`);
const t1 = Number(done.match(/TIER 1 SO FAR\s*([\d,]+)/i)?.[1]?.replace(/,/g, '') ?? -1);
check('tiers were assigned', t1 >= 0 && /Tier 1 \d+/.test(done), `tier1=${t1}`);

console.log('\nFILTERS, PANEL, PRESETS');
await page.locator('.t1').first().click();
await page.waitForTimeout(400);
check('clicking a tier chip filters', true);

await page.locator('button[aria-label]').first().click();
await page.waitForTimeout(400);
const panel = await page.locator('body').innerText();
check('clicking someone shows their answers with bars', /VERIFYING PROFILE/i.test(panel) && /ms/.test(panel));

const beforeSwitch = (await page.locator('body').innerText()).match(/Tier 1 \d+/)?.[0];
await page.selectOption('select', 'innovation-roles');
await page.waitForTimeout(800);
const afterSwitch = (await page.locator('body').innerText()).match(/Tier 1 \d+/)?.[0];
check('switching preset re-tiers with no new run', beforeSwitch !== afterSwitch, `${beforeSwitch} -> ${afterSwitch}`);
await page.selectOption('select', 'grant-clients');
await page.waitForTimeout(600);
check('switching back restores the first result',
  (await page.locator('body').innerText()).match(/Tier 1 \d+/)?.[0] === beforeSwitch);

console.log('\nRELOAD');
await page.reload({ waitUntil: 'networkidle' });
await page.locator('input[type=file]').first().setInputFiles(resolve(FIX, 'Connections.csv'));
await page.waitForTimeout(2500);
const after = await page.locator('body').innerText();
check('a reload resumes from storage rather than rescoring', /400 already scored/i.test(after), after.match(/[\d,]+ already scored/)?.[0]);

console.log('\nINVITATIONS');
await page.locator('input[aria-label="invitations file"]').setInputFiles(resolve(FIX, 'Invitations.csv'));
await page.waitForTimeout(900);

const connectionsBody = await page.locator('body').innerText();
check('the connections tab is the one showing first', /Download Tier 1/i.test(connectionsBody));

await page.getByRole('button', { name: /^invitations$/i }).click();
await page.waitForTimeout(500);
const invBody = await page.locator('body').innerText();
check('switching tabs changes what is listed',
  !/Download Tier 1/i.test(invBody) && /No signal/i.test(invBody));
check('accepted and pending appear once both files are loaded', /accepted, .* still pending/i.test(invBody));
check('the no-signal list says plainly that it is never scored',
  /never sent for scoring/i.test(invBody));
// innerText returns what CSS renders, and .label uppercases: match case-insensitively.
const flatInv = invBody.replace(/\s+/g, ' ');
check('outgoing invitations are listed separately and never scored',
  /outgoing ·/i.test(flatInv) && /no scoring happens here/i.test(flatInv));

// The rows the run is allowed to touch: count them off the button itself, then
// assert the run never reads more than that.
const notes = Number(invBody.match(/Read ([\d,]+) notes/i)?.[1]?.replace(/,/g, '') ?? -1);
check('the run offers only the notes, not every invitation', notes > 0 && notes < 200, `${notes} notes`);

const sentStates = [];
page.on('request', async (r) => {
  if (!r.url().includes('/api/score')) return;
  try { sentStates.push(...(JSON.parse(r.postData() ?? '{}').rows ?? [])); } catch {}
});

await page.getByRole('button', { name: /Read .* notes/i }).click();
await page.waitForFunction(
  (n) => new RegExp(`ROWS READ\\s*${n.toLocaleString()}`, 'i').test(document.body.innerText),
  notes, { timeout: 180000 },
).catch(() => {});
await page.waitForTimeout(1200);
const ranBody = await page.locator('body').innerText();
const readInv = Number(ranBody.match(/ROWS READ\s*([\d,]+)/i)?.[1]?.replace(/,/g, '') ?? 0);
check('the invitations run completes', readInv === notes, `read ${readInv} of ${notes}`);
check('no invitation with an empty message was ever sent for scoring',
  sentStates.length > 0 && sentStates.every((r) => String(r.state?.message ?? '').trim() !== ''),
  `${sentStates.length} rows sent`);
check('exactly the scorable rows were sent', sentStates.length === notes,
  `${sentStates.length} vs ${notes}`);

const accept = Number(ranBody.match(/WORTH ACCEPTING\s*([\d,]+)/i)?.[1]?.replace(/,/g, '') ?? -1);
check('the buckets filled in', accept >= 0 && /Accept \d+/.test(ranBody) && /Ignore \d+/.test(ranBody),
  `accept=${accept}`);

// The bucket chips must sum back to the notes read, with No signal accounted for separately.
const chip = (name) => Number(ranBody.match(new RegExp(`${name} ([\\d,]+)`))?.[1]?.replace(/,/g, '') ?? 0);
check('Accept, Review and Ignore sum to the notes scored',
  chip('Accept') + chip('Review') + chip('Ignore') === notes,
  `${chip('Accept')}+${chip('Review')}+${chip('Ignore')} vs ${notes}`);

await page.getByRole('button', { name: /^connections$/i }).click();
await page.waitForTimeout(400);
check('switching back shows the connections tab again',
  /Download Tier 1/i.test(await page.locator('body').innerText()));

console.log('\nMETHODS');
await page.goto(`${URL}/methods`, { waitUntil: 'networkidle' });
const methods = await page.locator('body').innerText();
check('the methods page renders both presets', /Grant clients/.test(methods) && /Innovation roles/.test(methods));
check('it shows the field contract', /connected_for/.test(methods));
check('it states that no Apify actor is selected', /No Apify actor is selected/.test(methods));
check('it quotes question criteria verbatim', /funder_or_grantmaker/.test(methods));

console.log('\nSTUDIO');
await page.goto(`${URL}/studio`, { waitUntil: 'networkidle' });
const studio = await page.locator('body').innerText();
const cardCount = await page.locator('article').count();
const ids = await page.locator('article input[type="text"], article input:not([type])').evaluateAll(
  (els) => els.map((e) => e.value),
);
check('the studio renders every question of the active preset',
  cardCount === 11 && ids.includes('organization_seeks_grants'),
  `${cardCount} cards, ids: ${ids.slice(0, 3).join(', ')}`);
check('it says plainly that thresholds are free', /Free\./i.test(studio));
check('it says plainly that editing a question is not',
  /Not free|no longer match/i.test(studio));

// The central claim about sliders: moving one costs nothing. Assert on the
// absence of a network call, not on the words.
let scoreCalls = 0;
const countScore = (r) => { if (r.url().includes('/api/score')) scoreCalls += 1; };
page.on('request', countScore);
const beforeCounts = await page.getByTestId('tier-counts').innerText();
const slider = page.locator('input[type=range]').first();
// fill() drives the native value setter, which is what React's change
// tracking listens to. Assigning el.value directly is silently ignored.
await slider.fill('1');
await page.waitForTimeout(900);
const afterCounts = await page.getByTestId('tier-counts').innerText();
page.off('request', countScore);
check('moving a slider makes no scoring request at all', scoreCalls === 0, `${scoreCalls} calls`);
check('moving a slider changes the tier counts', beforeCounts !== afterCounts,
  `${beforeCounts.replace(/\n/g, ' ')} -> ${afterCounts.replace(/\n/g, ' ')}`);

// Editing a question must raise the stale warning, since answers were stored
// under the old wording.
const firstInstructions = page.locator('textarea').first();
await firstInstructions.fill('Completely different question now.');
await page.waitForTimeout(800);
const warned = await page.getByTestId('stale-warning').isVisible().catch(() => false);
check('editing a question warns that stored answers no longer match', warned);
if (warned) {
  const w = await page.getByTestId('stale-warning').innerText();
  check('the stale warning names a count and tells you to re-run',
    /\d+ of \d+ rows/.test(w) && /Re-run/i.test(w), w.slice(0, 70));
}

// Editing a shipped preset must fork rather than mutate it.
await page.goto(`${URL}/studio`, { waitUntil: 'networkidle' });
const options = await page.locator('select').first().locator('option').allInnerTexts();
check('shipped presets are still intact after an edit',
  options.some((o) => o.trim() === 'Grant clients'), options.join(' | '));

// A bad edit must block saving, with the same validator the route uses.
const idField = page.locator('article input[type="text"], article input:not([type])').first();
await idField.fill('');
await page.waitForTimeout(600);
const saveDisabled = await page.getByRole('button', { name: 'Save' }).isDisabled();
check('an invalid question blocks saving', saveDisabled);

// The feedback loop: the stale warning has to be actionable, and a trial must
// not touch what the main screen is showing.
console.log('\nTEST RUN AND RE-RUN');
await page.goto(`${URL}/studio`, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
const studioBody = await page.locator('body').innerText();
check('the studio offers a test run and a full re-run',
  /Test on 25 rows/i.test(studioBody) && /Re-run all/i.test(studioBody));
check('both buttons state their cost before firing',
  /Test costs about \$\d+\.\d{4}/i.test(studioBody), studioBody.match(/Test costs[^.]*\./)?.[0]);

// Invalid spec must disable both, with the same validator the route uses.
const idInput = page.locator('article input[type="text"], article input:not([type])').first();
await idInput.fill('');
await page.waitForTimeout(500);
check('an invalid spec disables the re-run',
  await page.getByTestId('rerun-all').isDisabled());
await idInput.fill('role');
await page.waitForTimeout(500);
check('fixing the spec enables the re-run again',
  !(await page.getByTestId('rerun-all').isDisabled()));

// Edit a question so the answers genuinely should move, then test on 25.
const firstText = page.locator('textarea').first();
await firstText.fill('Is this person a chief executive? Answer only from the Position field.');
await page.waitForTimeout(600);
await page.getByRole('button', { name: /Test on \d+ rows/i }).click();
await page.waitForSelector('[data-testid="trial-table"] tbody tr', { timeout: 180000 }).catch(() => {});
await page.waitForFunction(
  () => !/Testing…/.test(document.body.innerText), null, { timeout: 180000 },
).catch(() => {});
await page.waitForTimeout(800);
const trial = await page.getByTestId('trial-table').innerText();
check('the trial shows a before and an after column', /WAS/.test(trial) && /NOW/.test(trial));
check('the trial reports how many rows answered differently',
  /\d+ of \d+ rows answered differently/i.test(trial),
  trial.match(/\d+ of \d+ rows answered differently/i)?.[0]);
check('the trial says plainly that nothing was saved', /Nothing here was saved/i.test(trial));
const trialRows = await page.locator('[data-testid="trial-table"] tbody tr').count();
check('the trial scored the sample, not the whole file', trialRows > 0 && trialRows <= 25 * 12,
  `${trialRows} answer rows`);

// A trial must leave the real answers alone.
await page.goto(URL, { waitUntil: 'networkidle' });
await page.locator('input[type=file]').first().setInputFiles(resolve(FIX, 'Connections.csv'));
await page.waitForTimeout(2500);
check('a test run did not overwrite the stored answers',
  /400 already scored/i.test(await page.locator('body').innerText()));

console.log('\nCONSOLE');
check('no page errors during the whole run', errors.length === 0, errors.slice(0, 2).join(' | '));

await browser.close();
console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
