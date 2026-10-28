import type { ReactNode } from 'react';
import { Button } from '@/components/Button';
import { roleLabel } from '@/components/MemberListItem';
import type { User } from '@/lib/api-types';

export type MemberProfileVariant = 'user' | 'other-admin' | 'me-admin';

/** Which variant of the profile applies (RG-04): the role of the member and whether it is the viewer. */
export function profileVariant(member: User, viewerId: number): MemberProfileVariant {
  if (member.id === viewerId && member.role === 'ADMIN') return 'me-admin';
  return member.role === 'ADMIN' ? 'other-admin' : 'user';
}

interface Props {
  member: User;
  variant: MemberProfileVariant;
  /** An action is under way: the buttons are blocked. */
  loading?: boolean;
  onGrantAdmin: () => void;
  onGenerateLink: () => void;
  onWithdrawAdmin: () => void;
}

/**
 * A member's page (D2, D4, D5), the actions depending on the variant (design/components.md, "MemberProfile"):
 * nobody gets a button to withdraw the right of another administrator (RG-04).
 */
export function MemberProfile({
  member,
  variant,
  loading = false,
  onGrantAdmin,
  onGenerateLink,
  onWithdrawAdmin,
}: Props) {
  const name = `${member.firstName} ${member.lastName}`;
  const linkButton: ReactNode = (
    <Button variant="secondary" disabled={loading} onClick={onGenerateLink}>
      Générer un lien de réinitialisation
    </Button>
  );

  return (
    <section aria-label="Fiche du membre" className="flex flex-col gap-md">
      <div className="flex flex-col gap-xs">
        <h1 className="text-title font-bold text-text">
          {name}
          {variant === 'me-admin' ? ' (moi)' : ''}
        </h1>
        <p className="text-text-muted">
          {member.email} · {roleLabel(member.role)}
        </p>
      </div>
      {variant === 'user' ? (
        <>
          <Button variant="primary" disabled={loading} onClick={onGrantAdmin}>
            Donner le droit administrateur
          </Button>
          {linkButton}
        </>
      ) : null}
      {variant === 'other-admin' ? (
        <>
          {linkButton}
          <p className="text-small text-text-muted">Aucune action pour lui retirer son droit.</p>
        </>
      ) : null}
      {variant === 'me-admin' ? (
        <Button variant="secondary" disabled={loading} onClick={onWithdrawAdmin}>
          Retirer mon droit administrateur
        </Button>
      ) : null}
    </section>
  );
}
