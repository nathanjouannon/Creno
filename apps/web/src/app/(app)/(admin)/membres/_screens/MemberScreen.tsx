'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { BackLink } from '@/components/BackLink';
import { LinkDialog } from '@/components/LinkDialog';
import { MemberProfile, profileVariant } from '@/components/MemberProfile';
import { useToast } from '@/components/Toast';
import { postJson, putJson } from '@/lib/api-client';
import type { Club, User } from '@/lib/api-types';
import { formatDayTime } from '@/lib/dates';
import { useApi } from '@/lib/use-api';
import { both, ScreenState } from '../../../events/_screens/ScreenState';

interface Link {
  url: string;
  expiresAt: string;
}

function MemberDetail({
  member,
  viewerId,
  timeZone,
  reload,
}: {
  member: User;
  viewerId: number;
  timeZone: string;
  reload: () => Promise<void>;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<Link | null>(null);

  async function changeRole(role: User['role']) {
    setBusy(true);
    const result = await putJson<User>(`/api/users/${member.id}/role`, { role });
    setBusy(false);
    if (!result.ok) {
      // D6: « Nomme d'abord un autre administrateur. », nothing changed
      showToast({ tone: 'danger', message: result.error.message });
      return reload();
    }
    if (member.id === viewerId && role === 'USER') {
      // F-10 S6: no longer an administrator, so no administration page: back to the events
      showToast({ tone: 'success', message: "Tu n'es plus administrateur." });
      router.push('/events');
      router.refresh();
      return;
    }
    await reload();
  }

  async function generateLink() {
    setBusy(true);
    const result = await postJson<Link>(`/api/users/${member.id}/password-resets`, undefined);
    setBusy(false);
    if (result.ok) setLink(result.data);
    else showToast({ tone: 'danger', message: result.error.message });
  }

  return (
    <>
      <MemberProfile
        member={member}
        variant={profileVariant(member, viewerId)}
        loading={busy}
        onGrantAdmin={() => changeRole('ADMIN')}
        onWithdrawAdmin={() => changeRole('USER')}
        onGenerateLink={generateLink}
      />
      {link ? (
        <LinkDialog
          variant="reset"
          link={link.url}
          validUntil={formatDayTime(link.expiresAt, timeZone)}
          onClose={() => setLink(null)}
        />
      ) : null}
    </>
  );
}

/** D2, D4, D5 (F-10): the member and the actions open to the viewer. An unknown member shows the API message. */
export function MemberScreen({ userId, viewerId }: { userId: string; viewerId: number }) {
  const member = useApi<User>(`/api/users/${userId}`);
  const club = useApi<Club>('/api/club');

  return (
    <>
      <BackLink href="/membres">Membres</BackLink>
      <ScreenState state={both(member, club)}>
        {([detail, { timezone }]) => (
          <MemberDetail
            member={detail}
            viewerId={viewerId}
            timeZone={timezone}
            reload={member.reload}
          />
        )}
      </ScreenState>
    </>
  );
}
