import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { UserMenu } from './UserMenu';

describe('UserMenu', () => {
  it('is closed at first, and opens with the sign-out action', async () => {
    render(<UserMenu firstName="Alex" />);
    const trigger = screen.getByRole('button', { name: 'Alex' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'Se déconnecter' })).toBeNull();

    await userEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Se déconnecter' })).toBeInTheDocument();
  });

  it('closes with Escape and gives the focus back to the trigger (keyboard only)', async () => {
    render(<UserMenu firstName="Alex" />);
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: 'Se déconnecter' })).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('button', { name: 'Se déconnecter' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Alex' })).toHaveFocus();
  });

  it('closes on a click outside', async () => {
    render(
      <div>
        <UserMenu firstName="Alex" />
        <p>ailleurs</p>
      </div>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Alex' }));
    await userEvent.click(screen.getByText('ailleurs'));
    expect(screen.queryByRole('button', { name: 'Se déconnecter' })).toBeNull();
  });
});
