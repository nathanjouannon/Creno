'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { EventHeader } from '@/components/EventHeader';
import { SlotCard } from '@/components/SlotCard';
import { SlotForm, emptySlotForm, type SlotFormValues } from '@/components/SlotForm';
import { LinkDialog } from '@/components/LinkDialog';
import { useToast } from '@/components/Toast';
import { deleteJson, patchJson, postJson, type ApiResult } from '@/lib/api-client';
import type { Club, EventDetail, Slot } from '@/lib/api-types';
import { formatDayTime, formatTime, toLocalParts } from '@/lib/dates';
import { useApi } from '@/lib/use-api';
import { both, ScreenState } from './ScreenState';

/** « 6 inscriptions seront supprimées. » (RG-10) */
function registrationsLost(count: number): string {
  return count > 1
    ? `${count} inscriptions seront supprimées. Cette action est définitive.`
    : '1 inscription sera supprimée. Cette action est définitive.';
}

function slotFormValues(slot: Slot, timeZone: string): SlotFormValues {
  const start = toLocalParts(slot.startsAt, timeZone);
  return {
    date: start.date,
    startTime: start.time,
    endTime: toLocalParts(slot.endsAt, timeZone).time,
    capacity: slot.capacity === null ? '' : String(slot.capacity),
    description: slot.description ?? '',
  };
}

const slotHours = (slot: Slot, timeZone: string) =>
  `${formatTime(slot.startsAt, timeZone)} – ${formatTime(slot.endsAt, timeZone)}`;

type Pending =
  | { kind: 'delete-event'; count: number }
  | { kind: 'delete-slot'; slot: Slot }
  | { kind: 'add-slot' }
  | { kind: 'edit-slot'; slot: Slot }
  | { kind: 'unregister'; slot: Slot }
  | { kind: 'remove-registration'; slot: Slot; attendee: Slot['attendees'][number] }
  | { kind: 'invitation'; url: string; expiresAt: string }
  | null;

interface Props {
  event: EventDetail;
  timeZone: string;
  editable: boolean;
  reload: () => Promise<void>;
}

function EventDetailView({ event, timeZone, editable, reload }: Props) {
  const router = useRouter();
  const { showToast } = useToast();
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);
  const [inviting, setInviting] = useState(false);
  // The slot whose registration is under way: only its button is blocked
  const [registeringSlot, setRegisteringSlot] = useState<number | null>(null);

  const close = () => setPending(null);

  /** After a refusal (the event became past meanwhile…), show the catalog message and the current state. */
  async function settle(result: ApiResult) {
    if (!result.ok) showToast({ tone: 'danger', message: result.error.message });
    await reload();
  }

  async function deleteEvent(): Promise<ApiResult> {
    const result = await deleteJson(`/api/events/${event.id}`);
    if (result.ok) {
      router.push('/events');
      router.refresh();
    }
    return result;
  }

  async function deleteSlot(slot: Slot): Promise<ApiResult> {
    const result = await deleteJson(`/api/slots/${slot.id}`);
    if (result.ok) await reload();
    return result;
  }

  // RG-10: a confirmation giving the number of registrations, or an immediate deletion when there is none
  async function askDeleteEvent() {
    const count = event.slots.reduce((sum, slot) => sum + slot.registeredCount, 0);
    if (count > 0) return setPending({ kind: 'delete-event', count });
    setBusy(true);
    const result = await deleteEvent();
    setBusy(false);
    if (!result.ok) await settle(result);
  }

  async function askDeleteSlot(slot: Slot) {
    if (slot.registeredCount > 0) return setPending({ kind: 'delete-slot', slot });
    await settle(await deleteSlot(slot));
  }

  // F-07: after any answer the slot is read again, so a refusal (last seat taken, slot started) shows its real state
  async function register(slot: Slot) {
    setRegisteringSlot(slot.id);
    const result = await postJson(`/api/slots/${slot.id}/registrations`, undefined);
    setRegisteringSlot(null);
    await settle(result);
  }

  async function unregister(slot: Slot): Promise<ApiResult> {
    const result = await deleteJson(`/api/slots/${slot.id}/registrations/me`);
    await reload();
    return result;
  }

  // F-01, RG-02: a new link each time; the API refuses once the event has started
  async function invite() {
    setInviting(true);
    const result = await postJson<{ url: string; expiresAt: string }>(
      `/api/events/${event.id}/invitations`,
      undefined,
    );
    setInviting(false);
    if (result.ok) setPending({ kind: 'invitation', ...result.data });
    else await settle(result);
  }

  // F-09, RG-08: the administrator removes anyone, even from a started slot
  async function removeRegistration(registrationId: number): Promise<ApiResult> {
    const result = await deleteJson(`/api/registrations/${registrationId}`);
    await reload();
    return result;
  }

  const variant = event.status === 'past' ? 'past' : editable ? 'admin' : 'volunteer';
  const slotVariant = variant === 'past' ? 'readonly' : variant;

  return (
    <div className="flex flex-col gap-md">
      <EventHeader
        variant={variant}
        event={event}
        timeZone={timeZone}
        actions={
          <>
            {/* RG-02: no invitation once the event has started */}
            {event.status === 'upcoming' ? (
              <Button
                variant="secondary"
                loading={inviting}
                onClick={invite}
                className="basis-full"
              >
                Inviter des bénévoles
              </Button>
            ) : null}
            <Button
              variant="secondary"
              onClick={() => router.push(`/events/${event.id}/edit`)}
              aria-label="Modifier l'événement"
            >
              Modifier
            </Button>
            <Button
              variant="secondary"
              loading={busy}
              onClick={askDeleteEvent}
              aria-label="Supprimer l'événement"
            >
              Supprimer
            </Button>
          </>
        }
      />

      {editable ? (
        <Button variant="secondary" onClick={() => setPending({ kind: 'add-slot' })}>
          + Ajouter un créneau
        </Button>
      ) : null}

      <section aria-label="Créneaux" className="flex flex-col gap-md">
        {event.slots.length === 0 ? (
          <EmptyState>Aucun créneau pour le moment.</EmptyState>
        ) : (
          event.slots.map((slot) => (
            <SlotCard
              key={slot.id}
              variant={slotVariant}
              slot={slot}
              loading={registeringSlot === slot.id}
              onRegister={() => register(slot)}
              onUnregister={() => setPending({ kind: 'unregister', slot })}
              timeZone={timeZone}
              showDay={
                toLocalParts(slot.startsAt, timeZone).date !==
                toLocalParts(event.startsAt, timeZone).date
              }
              onRemoveAttendee={
                variant === 'admin'
                  ? (attendee) => setPending({ kind: 'remove-registration', slot, attendee })
                  : undefined
              }
              onEdit={() => setPending({ kind: 'edit-slot', slot })}
              onDelete={() => askDeleteSlot(slot)}
            />
          ))
        )}
      </section>

      {pending?.kind === 'unregister' ? (
        <ConfirmDialog
          variant="unregister"
          title="Te désinscrire ?"
          onConfirm={() => unregister(pending.slot)}
          onClose={close}
        >
          {`Tu ne seras plus inscrit(e) au créneau ${slotHours(pending.slot, timeZone)}. Ta place sera libérée.`}
        </ConfirmDialog>
      ) : null}

      {pending?.kind === 'invitation' ? (
        <LinkDialog
          variant="invitation"
          link={pending.url}
          validUntil={formatDayTime(pending.expiresAt, timeZone)}
          onClose={close}
        />
      ) : null}

      {pending?.kind === 'remove-registration' ? (
        <ConfirmDialog
          variant="remove-registration"
          title="Retirer cet inscrit ?"
          onConfirm={() => removeRegistration(pending.attendee.registrationId)}
          onClose={close}
        >
          {`${pending.attendee.displayName ?? 'Cet ancien membre'} ne sera plus inscrit(e) au créneau ${slotHours(pending.slot, timeZone)}. La place sera libérée.`}
        </ConfirmDialog>
      ) : null}

      {pending?.kind === 'delete-event' ? (
        <ConfirmDialog
          variant="delete"
          title="Supprimer l'événement ?"
          onConfirm={deleteEvent}
          onClose={close}
        >
          {registrationsLost(pending.count)}
        </ConfirmDialog>
      ) : null}

      {pending?.kind === 'delete-slot' ? (
        <ConfirmDialog
          variant="delete"
          title="Supprimer le créneau ?"
          onConfirm={() => deleteSlot(pending.slot)}
          onClose={close}
        >
          {registrationsLost(pending.slot.registeredCount)}
        </ConfirmDialog>
      ) : null}

      {pending?.kind === 'add-slot' || pending?.kind === 'edit-slot' ? (
        <SlotForm
          title={pending.kind === 'add-slot' ? 'Ajouter un créneau' : 'Modifier le créneau'}
          timeZone={timeZone}
          event={event}
          defaultValues={
            pending.kind === 'edit-slot'
              ? slotFormValues(pending.slot, timeZone)
              : emptySlotForm(toLocalParts(event.startsAt, timeZone).date)
          }
          onClose={close}
          onSubmit={async (values) => {
            const result =
              pending.kind === 'edit-slot'
                ? await patchJson(`/api/slots/${pending.slot.id}`, values)
                : await postJson(`/api/events/${event.id}/slots`, values);
            if (result.ok) await reload();
            return result;
          }}
        />
      ) : null}
    </div>
  );
}

/**
 * The page of an event. Volunteer (B3, B4, B6, B7): the slots with their attendees and the registration actions;
 * the administrator has them too (RG-08). Administrator: Modifier, Supprimer, Ajouter un créneau and the actions of each slot (C2,
 * F-04, F-05). A past event shows none of them (RG-15). An unknown event, or a past one for a user, is « introuvable »
 * (RG-09): the API answers 404 and its message is shown.
 */
export function EventScreen({ eventId, isAdmin }: { eventId: string; isAdmin: boolean }) {
  const event = useApi<EventDetail>(`/api/events/${eventId}`);
  const club = useApi<Club>('/api/club');

  return (
    <ScreenState state={both(event, club)}>
      {([detail, { timezone }]) => (
        <EventDetailView
          event={detail}
          timeZone={timezone}
          editable={isAdmin && detail.status !== 'past'}
          reload={event.reload}
        />
      )}
    </ScreenState>
  );
}
