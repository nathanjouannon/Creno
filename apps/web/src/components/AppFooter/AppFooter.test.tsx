import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppFooter } from './AppFooter';

describe('AppFooter', () => {
  it('[T-021] links every page to the public information notice', () => {
    render(<AppFooter />);
    expect(
      screen.getByRole('contentinfo').querySelector('a[href="/mentions"]'),
    ).toHaveTextContent("Mentions d'information");
  });
});
