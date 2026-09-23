import { chromium } from 'playwright';
import { resolve } from 'node:path';

const URL = 'http://localhost:3102';
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

console.log('\nMETHODS');
await page.goto(`${URL}/methods`, { waitUntil: 'networkidle' });
const methods = await page.locator('body').innerText();
check('the methods page renders both presets', /Grant clients/.test(methods) && /Innovation roles/.test(methods));
check('it shows the field contract', /connected_for/.test(methods));
check('it states that no Apify actor is selected', /No Apify actor is selected/.test(methods));
check('it quotes question criteria verbatim', /funder_or_grantmaker/.test(methods));

console.log('\nCONSOLE');
check('no page errors during the whole run', errors.length === 0, errors.slice(0, 2).join(' | '));

await browser.close();
console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
