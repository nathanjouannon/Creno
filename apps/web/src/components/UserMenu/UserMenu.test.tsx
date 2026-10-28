import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/Toast';
import { deleteJson, getJson } from '@/lib/api-client';
import { UserMenu } from './UserMenu';

vi.mock('@/lib/api-client');

const renderMenu = () =>
  render(
    <ToastProvider>
      <UserMenu firstName="Alex" />
    </ToastProvider>,
  );

beforeEach(() => {
  vi.resetAllMocks();
});

describe('UserMenu', () => {
  it('is closed at first, and opens with the sign-out action', async () => {
    renderMenu();
    const trigger = screen.getByRole('button', { name: 'Alex' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'Se déconnecter' })).toBeNull();

    await userEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Se déconnecter' })).toBeInTheDocument();
  });

  it('closes with Escape and gives the focus back to the trigger (keyboard only)', async () => {
    renderMenu();
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: 'Se déconnecter' })).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('button', { name: 'Se déconnecter' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Alex' })).toHaveFocus();
  });

  it('closes on a click outside', async () => {
    render(
      <ToastProvider>
        <UserMenu firstName="Alex" />
        <p>ailleurs</p>
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Alex' }));
    await userEvent.click(screen.getByText('ailleurs'));
    expect(screen.queryByRole('button', { name: 'Se déconnecter' })).toBeNull();
  });

  describe('account deletion (F-11)', () => {
    it('[F-11 S1] opens the confirmation, and deleting signs out through the API', async () => {
      vi.mocked(getJson).mockResolvedValue({ ok: true, data: undefined });
      vi.mocked(deleteJson).mockResolvedValue({ ok: true, data: undefined });
      const assign = vi.fn();
      vi.stubGlobal('location', { assign });
      renderMenu();

      await userEvent.click(screen.getByRole('button', { name: 'Alex' }));
      await userEvent.click(screen.getByRole('button', { name: 'Supprimer mon compte' }));
      expect(await screen.findByRole('dialog', { name: 'Supprimer mon compte ?' })).toBeVisible();

      await userEvent.click(screen.getByRole('button', { name: 'Supprimer' }));
      expect(deleteJson).toHaveBeenCalledWith('/api/me');
      expect(assign).toHaveBeenCalledWith('/connexion');
      vi.unstubAllGlobals();
    });

    it('[F-11 S2] "Annuler" closes the confirmation without calling the API', async () => {
      vi.mocked(getJson).mockResolvedValue({ ok: true, data: undefined });
      renderMenu();
      await userEvent.click(screen.getByRole('button', { name: 'Alex' }));
      await userEvent.click(screen.getByRole('button', { name: 'Supprimer mon compte' }));
      await userEvent.click(await screen.findByRole('button', { name: 'Annuler' }));

      expect(screen.queryByRole('dialog')).toBeNull();
      expect(deleteJson).not.toHaveBeenCalled();
    });

    it('[F-11 S3] the last administrator gets the error toast and no confirmation', async () => {
      vi.mocked(getJson).mockResolvedValue({
        ok: false,
        error: { code: 'USER_LAST_ADMIN', message: "Nomme d'abord un autre administrateur." },
      });
      renderMenu();
      await userEvent.click(screen.getByRole('button', { name: 'Alex' }));
      await userEvent.click(screen.getByRole('button', { name: 'Supprimer mon compte' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        "Nomme d'abord un autre administrateur.",
      );
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });
});
