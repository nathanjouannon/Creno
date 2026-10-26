import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
// @ts-expect-error plain ESM module
import { buildTokens } from '../src/build.mjs';

const sample = {
  color: { brand: { $value: '#112233', $type: 'color' }, 'brand-hover': { $value: '{color.brand}', $type: 'color' } },
  space: { md: { $value: '16px', $type: 'dimension' } },
  radius: { button: { $value: '6px', $type: 'dimension' } },
  font: { 'size-small': { $value: '13px', $type: 'dimension' }, 'line-height': { $value: 1.5, $type: 'number' } },
  size: { 'form-max': { $value: '400px', $type: 'dimension' } },
};

describe('buildTokens', () => {
  it('produces Tailwind theme entries and CSS variables from a sample', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tokens-'));
    const input = join(dir, 'tokens.json');
    await writeFile(input, JSON.stringify(sample));
    const css: string = await buildTokens({ input, output: join(dir, 'out.css') });
    expect(css).toContain('--color-brand: #112233;');
    expect(css).toContain('--color-brand-hover: #112233;');
    expect(css).toContain('--spacing-md: 16px;');
    expect(css).toContain('--radius-button: 6px;');
    expect(css).toContain('--text-small: 13px;');
    expect(css).toContain('--container-form: 400px;');
    expect(css).toContain('--space-md: var(--spacing-md);');
    expect(css).toContain('--font-line-height: 1.5;');
    expect(await readFile(join(dir, 'out.css'), 'utf8')).toBe(css);
  });

  it('generated file is up to date with docs/design/tokens.json', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tokens-'));
    const input = fileURLToPath(new URL('../../../docs/design/tokens.json', import.meta.url));
    const fresh: string = await buildTokens({ input, output: join(dir, 'out.css') });
    const committed = await readFile(new URL('../generated/tokens.css', import.meta.url), 'utf8');
    expect(committed).toBe(fresh);
  });
});
