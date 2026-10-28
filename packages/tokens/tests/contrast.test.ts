import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const tokens = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../../docs/design/tokens.json', import.meta.url)), 'utf8'),
);
const color = (name: string): string => tokens.color[name].$value;

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const ratio = (foreground: string, background: string) => {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a) as [
    number,
    number,
  ];
  return (light + 0.05) / (dark + 0.05);
};

// WCAG 2.2 AA (ADR-0007): 4.5:1 for the 13 px text these pairs carry. The values are in docs/design/tokens.json.
const pairs: [string, string][] = [
  ['text', 'background'],
  ['text-muted', 'background'],
  ['text-muted', 'surface'],
  ['primary', 'background'],
  ['primary', 'surface'],
  ['on-primary', 'primary'],
  ['on-primary', 'primary-hover'],
  ['on-primary', 'danger'],
  ['on-primary', 'success'],
  ['danger', 'background'],
  ['danger', 'danger-surface'],
  ['success', 'background'],
  ['success', 'success-surface'],
  ['text', 'warning-surface'],
];

describe('color tokens, contrast (ADR-0007)', () => {
  it.each(pairs)('%s on %s reaches 4.5:1', (foreground, background) => {
    expect(ratio(color(foreground), color(background))).toBeGreaterThanOrEqual(4.5);
  });
});
