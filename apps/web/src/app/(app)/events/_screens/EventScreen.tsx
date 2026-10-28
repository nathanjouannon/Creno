'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { EventHeader } from '@/components/EventHeader';
import { SlotCard } from '@/components/SlotCard';
import { SlotForm, emptySlotForm, type SlotFormValues } from '@/components/SlotForm';
import { useToast } from '@/components/Toast';
import { deleteJson, patchJson, postJson, type ApiResult } from '@/lib/api-client';
import type { Club, EventDetail, Slot } from '@/lib/api-types';
import { toLocalParts } from '@/lib/dates';
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
  };
}

type Pending =
  | { kind: 'delete-event'; count: number }
  | { kind: 'delete-slot'; slot: Slot }
  | { kind: 'add-slot' }
  | { kind: 'edit-slot'; slot: Slot }
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

  const variant = event.status === 'past' ? 'past' : editable ? 'admin' : 'volunteer';

  return (
    <div className="flex flex-col gap-md">
      <EventHeader
        variant={variant}
        event={event}
        timeZone={timeZone}
        actions={
          <>
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
              variant={editable ? 'admin' : 'readonly'}
              slot={slot}
              timeZone={timeZone}
              showDay={
                toLocalParts(slot.startsAt, timeZone).date !==
                toLocalParts(event.startsAt, timeZone).date
              }
              onEdit={() => setPending({ kind: 'edit-slot', slot })}
              onDelete={() => askDeleteSlot(slot)}
            />
          ))
        )}
      </section>

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
 * The page of an event. Administrator: Modifier, Supprimer, Ajouter un créneau and the actions of each slot (C2,
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
