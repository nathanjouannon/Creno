import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PrivacyNotice } from './PrivacyNotice';

describe('PrivacyNotice', () => {
  it('[T-021] says what the club keeps and opens the notice in a new tab, announced as such', () => {
    render(<PrivacyNotice />);
    expect(screen.getByText(/nom, ton prénom et ton e-mail/)).toBeInTheDocument();
    const link = screen.getByRole('link', {
      name: "Mentions d'information (s'ouvre dans un nouvel onglet)",
    });
    expect(link).toHaveAttribute('href', '/mentions');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });
});
