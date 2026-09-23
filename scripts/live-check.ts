/** Scores hand-written rows against the live model, for both presets. Not part
 *  of the build. Run: TYPESAFE_API_KEY=... npx tsx scripts/live-check.ts */
import { scoreRow } from '../lib/jev';
import { PRESETS } from '../lib/presets';
import { tierFor, type TierInput } from '../lib/tiers';
import type { QuestionSpec } from '../lib/spec/types';

const rows: Record<string, string>[] = [
  { position: 'Executive Director', company: 'Calgary Immigrant Womens Association', connected_for: '1–3 years' },
  { position: 'Founder & CEO', company: 'Northline Cleantech Inc.', connected_for: 'under 1 year' },
  { position: 'Director of Development', company: 'Alberta Childrens Hospital Foundation', connected_for: '3+ years' },
  { position: 'Grants Manager', company: 'United Way of Calgary and Area', connected_for: '1–3 years' },
  { position: 'Program Officer', company: 'Calgary Foundation', connected_for: '3+ years' },
  { position: 'Recruitment Consultant', company: 'Bow Valley Staffing', connected_for: 'under 1 year' },
  { position: 'Senior Vice President, Global Supply Chain', company: 'Nestlé', connected_for: '3+ years' },
  { position: 'Professor of Chemical Engineering', company: 'University of Calgary', connected_for: '3+ years' },
  { position: 'Director of Innovation', company: 'Platform Calgary', connected_for: '1–3 years' },
  { position: 'Board Chair (volunteer)', company: 'Inglewood Community Association', connected_for: '3+ years' },
  { position: '', company: '', connected_for: '3+ years' },
];

async function runPreset(presetId: string) {
  const preset = PRESETS.find((p) => p.id === presetId)!;
  const qs = preset.questions.filter((q: QuestionSpec) => q.tab === 'connections');
  console.log(`\n${'='.repeat(78)}\n${preset.name.toUpperCase()} — ${preset.purpose}\n${'='.repeat(78)}\n`);
  let tokens = 0;

  for (const [i, row] of rows.entries()) {
    const r = await scoreRow(`r${i}`, row, qs);
    if (r.error) { console.log(`  ERROR ${r.error}`); continue; }
    tokens += r.inputTokens;
    const input: TierInput = { answers: r.answers, positionEmpty: !row.position };
    const tier = tierFor(presetId, input, preset.thresholds);
    const role = r.answers.role as any;
    const label = `${row.position || '(no position)'} @ ${row.company || '(no company)'}`;
    const extra = presetId === 'grant-clients'
      ? `seeks=${(r.answers.organization_seeks_grants as any)?.noul.toFixed(2)} ` +
        `inhouse=${(r.answers.has_inhouse_fundraising as any)?.noul.toFixed(2)} ` +
        `type=${(r.answers.company_type as any)?.choice}`
      : `couldHire=${(r.answers.could_hire_or_refer as any)?.noul.toFixed(2)} ` +
        `innovOrg=${(r.answers.organization_runs_innovation_programs as any)?.noul.toFixed(2)}`;
    console.log(`${tier.toUpperCase().padEnd(9)} ${label}`);
    console.log(`          role=${role.choice} (${role.confidence.toFixed(2)})  ${extra}  ${r.latencyMs}ms\n`);
  }
  console.log(`${preset.name}: ${tokens} input tokens, $${((tokens / 1e6) * 0.042).toFixed(5)}`);
}

async function main() {
  await runPreset('grant-clients');
  await runPreset('innovation-roles');
}
main();
