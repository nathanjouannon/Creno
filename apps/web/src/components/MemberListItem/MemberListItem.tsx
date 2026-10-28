import { Card } from '@/components/Card';
import type { User } from '@/lib/api-types';

export const roleLabel = (role: User['role']) =>
  role === 'ADMIN' ? 'Administrateur' : 'Utilisateur';

/** A member of the list (D1): « Martin Alex · Utilisateur », the e-mail below. The role is a text, not a tag. */
export function MemberListItem({ member }: { member: User }) {
  return (
    <Card href={`/membres/${member.id}`}>
      <p className="font-medium text-text">
        {member.lastName} {member.firstName} · {roleLabel(member.role)}
      </p>
      <p className="text-small text-text-muted">{member.email}</p>
    </Card>
  );
}
