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
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const DEFAULTS = resolve(process.cwd(), 'lib/questions.defaults.ts');

async function main() {
  if (!existsSync(DEFAULTS)) {
    console.log('check-contract: no default question set yet (lib/questions.defaults.ts).');
    console.log('check-contract: nothing to verify. Build continues.');
    return;
  }

  // Resolved through a variable so the typechecker does not demand the module
  // before the ICP exists and it has been written.
  const defaultsPath = '../lib/questions.defaults.ts';
  const { DEFAULT_QUESTIONS } = (await import(defaultsPath)) as {
    DEFAULT_QUESTIONS: import('../lib/spec/types').QuestionSpec[];
  };
  const { validateQuestions } = await import('../lib/spec/validate');

  const errors = validateQuestions(DEFAULT_QUESTIONS).filter((e) => e.severity === 'error');
  const warnings = validateQuestions(DEFAULT_QUESTIONS).filter((e) => e.severity === 'warning');

  for (const w of warnings) console.warn(`check-contract: warning  ${w.questionId}: ${w.message}`);

  if (errors.length > 0) {
    console.error('\ncheck-contract: the shipped default questions break the field contract.\n');
    for (const e of errors) console.error(`  ${e.questionId}${e.field ? ` [${e.field}]` : ''}: ${e.message}`);
    console.error('');
    process.exit(1);
  }

  console.log(`check-contract: ${DEFAULT_QUESTIONS.length} default questions, all inside the contract.`);
}

main().catch((err) => {
  console.error('check-contract failed to run:', err);
  process.exit(1);
});
