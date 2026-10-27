// `pnpm api:generate` writes the contract files; `pnpm api:check` fails when the committed ones are stale (ADR-0014).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildArtifacts } from '../src/contract/build';

const [command, ...args] = process.argv.slice(2);
const outFlag = args.indexOf('--out');
const outDir = resolve(
  outFlag >= 0
    ? args[outFlag + 1]!
    : join(dirname(fileURLToPath(import.meta.url)), '../../../docs/api'),
);

const artifacts = buildArtifacts();

if (command === 'generate') {
  mkdirSync(outDir, { recursive: true });
  for (const [name, content] of Object.entries(artifacts))
    writeFileSync(join(outDir, name), content);
  console.log(`Wrote ${Object.keys(artifacts).join(', ')} to ${outDir}`);
} else if (command === 'check') {
  const stale = Object.entries(artifacts)
    .filter(
      ([name, content]) =>
        !existsSync(join(outDir, name)) || readFileSync(join(outDir, name), 'utf8') !== content,
    )
    .map(([name]) => name);
  if (stale.length > 0) {
    console.error(
      `Out of date: ${stale.join(', ')}. Run \`pnpm api:generate\` and commit the result.`,
    );
    process.exit(1);
  }
  console.log('API contract files are up to date.');
} else {
  console.error('Usage: api.ts generate|check [--out <dir>]');
  process.exit(2);
}
