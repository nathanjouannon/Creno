'use client';

import { EmptyState } from '@/components/EmptyState';
import { MemberListItem } from '@/components/MemberListItem';
import { PageTitle } from '@/components/PageTitle';
import type { User } from '@/lib/api-types';
import { useApi } from '@/lib/use-api';
import { ScreenState } from '../../../events/_screens/ScreenState';

/** D1 (F-10): name, first name, e-mail and role of every member, sorted by the API. */
export function MemberListScreen() {
  const members = useApi<User[]>('/api/users');
  return (
    <>
      <PageTitle>Membres</PageTitle>
      <ScreenState state={members}>
        {(list) =>
          list.length === 0 ? (
            <EmptyState>Aucun membre.</EmptyState>
          ) : (
            <ul aria-label="Membres" className="flex flex-col gap-md">
              {list.map((member) => (
                <li key={member.id}>
                  <MemberListItem member={member} />
                </li>
              ))}
            </ul>
          )
        }
      </ScreenState>
    </>
  );
}
