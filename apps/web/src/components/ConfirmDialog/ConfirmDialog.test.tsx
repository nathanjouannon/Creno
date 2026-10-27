import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ApiResult } from '@/lib/api-client';
import { ConfirmDialog, type ConfirmDialogVariant } from './ConfirmDialog';

const ok: ApiResult = { ok: true, data: undefined };

function open(variant: ConfirmDialogVariant = 'delete', onConfirm = vi.fn().mockResolvedValue(ok)) {
  const onClose = vi.fn();
  render(
    <>
      <button>Ouvrir</button>
      <ConfirmDialog variant={variant} title="Supprimer ?" onConfirm={onConfirm} onClose={onClose}>
        3 inscrits seront retirés.
      </ConfirmDialog>
    </>,
  );
  return { onConfirm, onClose };
}

describe('ConfirmDialog', () => {
  it.each([
    ['unregister', 'Me désinscrire'],
    ['delete', 'Supprimer'],
    ['remove-registration', 'Retirer'],
  ] as const)('%s: the action button reads "%s"', (variant, label) => {
    open(variant);
    expect(screen.getByRole('dialog', { name: 'Supprimer ?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeInTheDocument();
  });

  it('puts the focus on "Annuler", not on the destructive action', () => {
    open();
    expect(screen.getByRole('button', { name: 'Annuler' })).toHaveFocus();
  });

  it('closes with Escape, with "Annuler" and with a click on the backdrop', async () => {
    const { onClose } = open();
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    await userEvent.click(screen.getByRole('dialog').parentElement!);
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('keeps the focus inside the window', async () => {
    open();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Supprimer' })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Annuler' })).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Supprimer' })).toHaveFocus();
  });

  it('confirming runs the action, then closes', async () => {
    const { onConfirm, onClose } = open();
    await userEvent.click(screen.getByRole('button', { name: 'Supprimer' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('submitting: buttons are blocked and the window cannot be dismissed', async () => {
    let finish: (result: ApiResult) => void = () => {};
    const { onClose } = open(
      'delete',
      vi.fn(() => new Promise<ApiResult>((resolve) => (finish = resolve))),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Supprimer' }));

    expect(screen.getByRole('button', { name: 'Supprimer' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeDisabled();
    await userEvent.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
    finish(ok);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('error: the API message is shown and the window stays open', async () => {
    const { onClose } = open(
      'delete',
      vi.fn().mockResolvedValue({
        ok: false,
        error: { code: 'INTERNAL_ERROR', message: 'Une erreur est survenue.' },
      } satisfies ApiResult),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Supprimer' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Une erreur est survenue.');
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Supprimer' })).toBeEnabled();
  });
});
