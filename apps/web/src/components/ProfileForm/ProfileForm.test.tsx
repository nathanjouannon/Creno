import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/Toast';
import { patchJson } from '@/lib/api-client';
import { ProfileForm } from './ProfileForm';

vi.mock('@/lib/api-client');
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const user = { firstName: 'Léa', lastName: 'Bernard', email: 'lea@club.fr' };
const renderForm = () =>
  render(
    <ToastProvider>
      <ProfileForm user={user} />
    </ToastProvider>,
  );

beforeEach(() => vi.resetAllMocks());

describe('ProfileForm (F-20, RG-18)', () => {
  it('[F-20 S1] shows the saved values and no password field', () => {
    renderForm();
    expect(screen.getByLabelText('Prénom')).toHaveValue('Léa');
    expect(screen.getByLabelText('E-mail')).toHaveValue('lea@club.fr');
    expect(screen.queryByLabelText('Mot de passe actuel')).toBeNull();
  });

  it('RG-18: asks for the current password only once the address differs', async () => {
    renderForm();
    await userEvent.clear(screen.getByLabelText('E-mail'));
    await userEvent.type(screen.getByLabelText('E-mail'), 'nouvelle@club.fr');
    expect(screen.getByLabelText('Mot de passe actuel')).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText('E-mail'));
    await userEvent.type(screen.getByLabelText('E-mail'), 'lea@club.fr');
    expect(screen.queryByLabelText('Mot de passe actuel')).toBeNull();
  });

  it('[F-20 S6] sends nothing when the name is empty', async () => {
    renderForm();
    await userEvent.clear(screen.getByLabelText('Nom'));
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByText('Ce champ est obligatoire.')).toBeInTheDocument();
    expect(patchJson).not.toHaveBeenCalled();
  });

  it('[F-20 S5] shows a taken address under the e-mail field', async () => {
    vi.mocked(patchJson).mockResolvedValue({
      ok: false,
      error: {
        code: 'USER_EMAIL_IN_USE',
        message: 'Cette adresse est déjà utilisée par un autre compte.',
      },
    });
    renderForm();
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(
      await screen.findByText('Cette adresse est déjà utilisée par un autre compte.'),
    ).toBeInTheDocument();
  });
});
