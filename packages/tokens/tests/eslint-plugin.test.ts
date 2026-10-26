import { Linter } from 'eslint';
import { describe, expect, it } from 'vitest';
// @ts-expect-error plain ESM module
import plugin from '../src/eslint-plugin.mjs';

const linter = new Linter();
const run = (code: string) =>
  linter.verify(code, [
    {
      files: ['**/*.tsx'],
      languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
      plugins: { creno: plugin },
      rules: { 'creno/no-hardcoded-style': 'error' },
    },
  ], 'a.tsx');

describe('no-hardcoded-style', () => {
  it.each([
    '<a className="bg-primary text-text-muted rounded-button p-md md:p-lg" />',
    '<a className={`flex ${x} desktop:p-md`} />',
    '<a className={cn("w-full", y && "h-control")} />',
  ])('accepts token classes: %s', (code) => {
    expect(run(`const x = ${code};`)).toEqual([]);
  });

  it.each([
    '<a className="bg-[#2563EB]" />',
    '<a className="p-[13px]" />',
    '<a className="flex md:w-[calc(100%-2px)]" />',
    '<a className={cn("ok", "text-[red]")} />',
    '<a className="text-[#fff]" />',
    '<a style={{ color: "#fff" }} />',
  ])('rejects: %s', (code) => {
    expect(run(`const x = ${code};`).length).toBeGreaterThan(0);
  });
});
