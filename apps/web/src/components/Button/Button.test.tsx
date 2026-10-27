import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('keeps its label and ignores clicks while loading (never a double submission)', async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Enregistrer
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Enregistrer' });
    await userEvent.click(button);
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(onClick).not.toHaveBeenCalled();
  });

  it('is a plain button unless asked otherwise, so it never submits a form by accident', () => {
    render(<Button>Annuler</Button>);
    expect(screen.getByRole('button', { name: 'Annuler' })).toHaveAttribute('type', 'button');
  });

  it('a disabled button keeps its text ("Complet")', () => {
    render(<Button disabled>Complet</Button>);
    expect(screen.getByRole('button', { name: 'Complet' })).toBeDisabled();
  });
});
