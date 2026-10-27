import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LinkDialog } from './LinkDialog';

const link = 'https://creno.example.org/invitation/abc';

function open(variant: 'invitation' | 'reset' = 'invitation') {
  render(
    <LinkDialog variant={variant} link={link} validUntil="15 janvier 2027" onClose={vi.fn()} />,
  );
}

describe('LinkDialog', () => {
  it('RG-02: the invitation says it is reusable and valid until the start of the event', () => {
    open('invitation');
    expect(screen.getByRole('dialog', { name: "Lien d'invitation" })).toBeInTheDocument();
    expect(screen.getByText(/réutilisable/)).toHaveTextContent('15 janvier 2027');
  });

  it('RG-12: the reset link says it is single-use and valid 3 days', () => {
    open('reset');
    expect(screen.getByText(/usage unique, valable 3 jours/)).toBeInTheDocument();
  });

  it('copied: the link goes to the clipboard and the button says so', async () => {
    const user = userEvent.setup();
    open();
    await user.click(screen.getByRole('button', { name: 'Copier le lien' }));
    expect(await navigator.clipboard.readText()).toBe(link);
    expect(screen.getByRole('button', { name: 'Lien copié' })).toBeInTheDocument();
  });

  it('error: when the copy is refused, the link is selected for a manual copy', async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'));
    open();
    await user.click(screen.getByRole('button', { name: 'Copier le lien' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Copie impossible');
    const field = screen.getByLabelText('Lien') as HTMLInputElement;
    expect(field.selectionStart).toBe(0);
    expect(field.selectionEnd).toBe(link.length);
  });
});
