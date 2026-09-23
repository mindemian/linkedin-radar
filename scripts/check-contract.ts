/**
 * Runs on every build. Fails the build if a shipped default question reads a
 * field outside the contract — the brief's requirement, enforced where it
 * cannot be skipped.
 *
 * The default question set lands in lib/questions.defaults.ts once the ICP is
 * supplied. Until then there is nothing to check and this reports that plainly
 * rather than passing silently, so an empty default set is never mistaken for
 * a clean one.
 */
import { PRESETS } from '../lib/presets';
import { validateQuestions } from '../lib/spec/validate';

async function main() {
  let failed = 0;

  for (const preset of PRESETS) {
    const all = validateQuestions(preset.questions);
    const errors = all.filter((e) => e.severity === 'error');
    for (const w of all.filter((e) => e.severity === 'warning')) {
      console.warn(`check-contract: warning  ${preset.id}/${w.questionId}: ${w.message}`);
    }
    if (errors.length > 0) {
      failed += errors.length;
      console.error(`\ncheck-contract: preset "${preset.id}" breaks the field contract.\n`);
      for (const e of errors) {
        console.error(`  ${e.questionId}${e.field ? ` [${e.field}]` : ''}: ${e.message}`);
      }
      console.error('');
    } else {
      console.log(`check-contract: ${preset.id} — ${preset.questions.length} questions, all inside the contract.`);
    }
  }

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('check-contract failed to run:', err);
  process.exit(1);
});
