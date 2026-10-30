import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { User } from '@/lib/api-types';
import { MemberProfile, profileVariant } from './MemberProfile';

const member = (overrides: Partial<User> = {}): User => ({
  id: 2,
  firstName: 'Alex',
  lastName: 'Martin',
  email: 'alex@exemple.fr',
  role: 'USER',
  createdAt: '2027-01-01T00:00:00.000Z',
  ...overrides,
});

const handlers = () => ({
  onGrantAdmin: vi.fn(),
  onGenerateLink: vi.fn(),
  onWithdrawAdmin: vi.fn(),
});

describe('profileVariant', () => {
  it('RG-04: tells a user, another administrator and oneself apart', () => {
    expect(profileVariant(member(), 1)).toBe('user');
    expect(profileVariant(member({ role: 'ADMIN' }), 1)).toBe('other-admin');
    expect(profileVariant(member({ id: 1, role: 'ADMIN' }), 1)).toBe('me-admin');
  });
});

describe('MemberProfile', () => {
  it('[F-10 S2] [F-10 S7] a user: give the right and generate a link', async () => {
    const h = handlers();
    render(<MemberProfile member={member()} variant="user" {...h} />);
    expect(screen.getByText('alex@exemple.fr · Utilisateur')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Donner le droit administrateur' }));
    await userEvent.click(
      screen.getByRole('button', { name: 'Générer un lien de réinitialisation' }),
    );
    expect(h.onGrantAdmin).toHaveBeenCalledOnce();
    expect(h.onGenerateLink).toHaveBeenCalledOnce();
  });

  it('[F-10 S4] RG-04, RG-12: another administrator: no way to withdraw their right nor to reset their password (#82)', () => {
    render(
      <MemberProfile member={member({ role: 'ADMIN' })} variant="other-admin" {...handlers()} />,
    );
    expect(screen.queryByRole('button')).toBeNull();
    expect(
      screen.getByText(
        'Aucune action pour lui retirer son droit ni réinitialiser son mot de passe.',
      ),
    ).toBeInTheDocument();
  });

  it('[F-10 S3] my own page: only « Retirer mon droit administrateur »', async () => {
    const h = handlers();
    render(<MemberProfile member={member({ role: 'ADMIN' })} variant="me-admin" {...h} />);
    expect(screen.getByRole('heading', { name: 'Alex Martin (moi)' })).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: 'Retirer mon droit administrateur' }));
    expect(h.onWithdrawAdmin).toHaveBeenCalledOnce();
  });
});
