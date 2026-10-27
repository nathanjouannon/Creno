import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

const packageDir = fileURLToPath(new URL('..', import.meta.url));
const docsApi = fileURLToPath(new URL('../../../docs/api', import.meta.url));
const copy = mkdtempSync(join(tmpdir(), 'creno-api-'));
afterAll(() => rmSync(copy, { recursive: true, force: true }));

function apiCheck(dir: string) {
  const r = spawnSync('pnpm', ['exec', 'tsx', 'scripts/api.ts', 'check', '--out', dir], {
    cwd: packageDir,
    encoding: 'utf8',
  });
  return { status: r.status, output: r.stdout + r.stderr };
}

describe('pnpm api:check', () => {
  it('passes on the committed contract files', () => {
    const r = apiCheck(docsApi);
    expect(r.status, r.output).toBe(0);
  });

  it('fails when a committed file differs from the generated one, naming the file', () => {
    cpSync(docsApi, copy, { recursive: true });
    const openapi = join(copy, 'openapi.yaml');
    writeFileSync(openapi, readFileSync(openapi, 'utf8').replace('minimum: 1', 'minimum: 2'));
    const r = apiCheck(copy);
    expect(r.status).toBe(1);
    expect(r.output).toContain('openapi.yaml');
    expect(r.output).toContain('pnpm api:generate');
  });

  it('fails when a generated file is missing', () => {
    rmSync(join(copy, 'errors.json'));
    const r = apiCheck(copy);
    expect(r.status).toBe(1);
    expect(r.output).toContain('errors.json');
  });

  it('api:generate repairs the directory', () => {
    const generate = spawnSync(
      'pnpm',
      ['exec', 'tsx', 'scripts/api.ts', 'generate', '--out', copy],
      { cwd: packageDir, encoding: 'utf8' },
    );
    expect(generate.status).toBe(0);
    expect(apiCheck(copy).status).toBe(0);
  });
});
