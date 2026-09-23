/** Scores a handful of hand-written rows against the live model, to see whether
 *  the default questions actually behave. Not part of the build. */
import { scoreRow } from '../lib/jev';
import { DEFAULT_QUESTIONS } from '../lib/questions.defaults';
import { TARGET_ROLE_IDS, PREFERRED_INDUSTRY_IDS } from '../lib/icp.config';
import { tierFor, DEFAULT_THRESHOLDS } from '../lib/tiers';

const rows = [
  { position: 'Executive Director', company: 'Calgary Food Bank', connected_for: '1–3 years' },
  { position: 'Director of Development', company: 'Alberta Children’s Hospital Foundation', connected_for: '3+ years' },
  { position: 'Founder & CEO', company: 'Northline Cleantech Inc.', connected_for: 'under 1 year' },
  { position: 'Senior Vice President, Global Supply Chain', company: 'Nestlé', connected_for: '3+ years' },
  { position: 'Professor of Chemical Engineering', company: 'University of Calgary', connected_for: '3+ years' },
  { position: 'Technical Recruiter', company: 'Randstad', connected_for: 'under 1 year' },
  { position: '', company: '', connected_for: '3+ years' },
  { position: 'Grants Manager', company: 'United Way of Calgary', connected_for: '1–3 years' },
];

const connQs = DEFAULT_QUESTIONS.filter((q) => q.tab === 'connections');

async function main() {
  console.log(`\nScoring ${rows.length} rows against ${connQs.length} questions.\n`);
  let tokens = 0;
  for (const [i, row] of rows.entries()) {
    const r = await scoreRow(`r${i}`, row, connQs);
    if (r.error) { console.log(`  ERROR ${r.error}`); continue; }
    tokens += r.inputTokens;
    const role = r.answers.role as any;
    const ct = r.answers.company_type as any;
    const tier = tierFor(
      {
        answers: r.answers,
        positionEmpty: !row.position,
        targetRoles: TARGET_ROLE_IDS,
        preferredIndustries: PREFERRED_INDUSTRY_IDS,
      },
      DEFAULT_THRESHOLDS,
    );
    const label = `${row.position || '(no position)'} @ ${row.company || '(no company)'}`;
    console.log(`${tier.toUpperCase().padEnd(9)} ${label}`);
    console.log(
      `          role=${role.choice} (${role.confidence.toFixed(2)})  ` +
      `type=${ct.choice} (${ct.confidence.toFixed(2)})  ` +
      `disq=${(r.answers.disqualified as any).noul.toFixed(2)}  ` +
      `bigbrand=${(r.answers.is_big_public_brand as any).noul.toFixed(2)}  ` +
      `${r.latencyMs}ms\n`,
    );
  }
  console.log(`Total input tokens ${tokens}, cost $${((tokens / 1e6) * 0.042).toFixed(5)}\n`);
}
main();
