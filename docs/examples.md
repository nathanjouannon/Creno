# Exemples de code de référence – Créno

Statut : version 1.0 (2026-10-26). Extraits courts du style attendu, tous sur le même cas : **s'inscrire à un créneau** (F-07, RG-07, RG-08, RG-09, RG-15, `POST /slots/{slotId}/registrations`). Ils appliquent `conventions.md`. Les sections 1 à 5 sont encore des extraits visés par T-004, T-007 et T-014 ; les sections 6 et 7 renvoient vers le code réel de T-010. Quand le vrai code existe, la tâche qui l'écrit remplace l'extrait correspondant par un renvoi vers le fichier réel, qui devient la référence.

## 1. Schéma de validation (`packages/validation`)

Des codes de champ, jamais de texte (ADR-0009). Le type se déduit du schéma.

```ts
import { z } from 'zod';

const dateTime = z.string().datetime({ message: 'FIELD_DATE_INVALID' });

export const slotInputSchema = z
  .object({
    startsAt: dateTime,
    endsAt: dateTime,
    // RG-07: null = unlimited places, otherwise at least 1
    capacity: z.number().int().min(1, { message: 'FIELD_CAPACITY_TOO_LOW' }).nullable().default(null),
  })
  .refine((slot) => new Date(slot.endsAt) > new Date(slot.startsAt), {
    message: 'FIELD_END_NOT_AFTER_START',
    path: ['endsAt'],
  });

export type SlotInput = z.infer<typeof slotInputSchema>;
```

## 2. Route d'API (`apps/web/src/app/api/slots/[slotId]/registrations/route.ts`)

Mince : authentification, validation, un appel de service. Aucune règle ici.

```ts
import { slotIdParamsSchema } from '@creno/validation';
import { route } from '@/modules/shared';
import { registrationService } from '@/modules/registrations';

export const POST = route({ auth: 'user', params: slotIdParamsSchema }, async ({ params, user }) => ({
  status: 201,
  body: await registrationService.register(user, params.slotId),
}));
```

## 3. Service : règles pures, puis transaction (`registrations/registration.service.ts`)

Les règles sont dans une fonction pure testable sans base ; le service orchestre. L'heure vient de l'horloge injectée.

```ts
import { AppError } from '@creno/validation';

/** Rules of RG-07, RG-08, RG-09 and RG-15; throws the catalog error that applies. */
export function assertCanRegister(slot: SlotForRegistration, user: SessionUser, now: Date): void {
  const eventIsPast = slot.event.endsAt <= now;

  // RG-09: a past event does not exist for a regular user; RG-15: read-only for an admin
  if (eventIsPast && user.role !== 'ADMIN') throw new AppError('SLOT_NOT_FOUND');
  if (eventIsPast) throw new AppError('EVENT_PAST');

  // RG-08: the slot has started as soon as now >= startsAt (strictly before to register)
  if (slot.startsAt <= now) throw new AppError('SLOT_STARTED', { slotId: slot.id });
  if (slot.attendeeIds.includes(user.id)) throw new AppError('REGISTRATION_ALREADY_EXISTS', { slotId: slot.id });

  // RG-07: an unlimited slot (capacity null) is never full
  if (slot.capacity !== null && slot.attendeeIds.length >= slot.capacity) {
    throw new AppError('SLOT_FULL', { slotId: slot.id });
  }
}

export function createRegistrationService({ repository, clock }: Dependencies) {
  return {
    async register(user: SessionUser, slotId: number): Promise<SlotView> {
      // RG-07: check and insert in one serializable transaction so the last seat goes to one person
      return repository.inSerializableTransaction(async (tx) => {
        const slot = await tx.findSlotForRegistration(slotId);
        if (!slot) throw new AppError('SLOT_NOT_FOUND');

        assertCanRegister(slot, user, clock.now());
        await tx.createRegistration({ slotId, userId: user.id });

        return toSlotView(await tx.findSlotWithAttendees(slotId), user, clock.now());
      });
    },
  };
}
```

Le mécanisme de verrouillage de RG-07 et RG-04 (transaction sérialisable avec nouvelle tentative, verrou de ligne ou verrou consultatif) est fixé et justifié en T-014 ; le test de concurrence de la section 5 en est le juge. L'important : la vérification et l'écriture sont dans la même transaction.

## 4. Dépôt : accès aux données, aucune règle (`registrations/registration.repository.ts`)

```ts
import { Prisma, type PrismaClient } from '@prisma/client';

export function createRegistrationRepository(prisma: PrismaClient) {
  return {
    inSerializableTransaction: <T>(work: (tx: RegistrationTx) => Promise<T>) =>
      withRetryOnConflict(() =>
        prisma.$transaction((tx) => work(toRegistrationTx(tx)), {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        }),
      ),
  };
}

function toRegistrationTx(tx: Prisma.TransactionClient): RegistrationTx {
  return {
    findSlotForRegistration: async (slotId) => {
      const slot = await tx.slot.findUnique({
        where: { id: slotId },
        include: { event: { select: { endsAt: true } }, registrations: { select: { userId: true } } },
      });
      return slot && { ...slot, attendeeIds: slot.registrations.map((r) => r.userId) };
    },
    createRegistration: ({ slotId, userId }) => tx.registration.create({ data: { slotId, userId } }),
    // … findSlotWithAttendees
  };
}
```

## 5. Tests

Unitaire : règle pure, horloge figée, frontière exacte (`registration.service.test.ts`).

```ts
const now = new Date('2027-01-14T09:00:00Z');

describe('assertCanRegister', () => {
  it('[F-07 S4 bis] refuses at the exact start of the slot', () => {
    const slot = buildSlotForRegistration({ startsAt: now });
    expect(() => assertCanRegister(slot, buildSessionUser(), now)).toThrowAppError('SLOT_STARTED');
  });

  it('RG-07: an unlimited slot is never full', () => {
    const slot = buildSlotForRegistration({ capacity: null, attendeeIds: range(500) });
    expect(() => assertCanRegister(slot, buildSessionUser(), now)).not.toThrow();
  });
});
```

Intégration : route, base réelle, concurrence (`tests/integration/registrations.test.ts`).

```ts
it('[F-07 S3] RG-07: the last seat goes to exactly one of 50 simultaneous requests', async () => {
  const slot = await createSlot({ capacity: 4, registeredCount: 3 });
  const users = await createUsers(50);

  const responses = await Promise.all(users.map((user) => api(user).post(`/slots/${slot.id}/registrations`)));

  expect(responses.filter((r) => r.status === 201)).toHaveLength(1);
  expect(responses.filter((r) => r.status === 409 && r.body.code === 'SLOT_FULL')).toHaveLength(49);
  expect(await countRegistrations(slot.id)).toBe(4);
});
```

## 6. Composant : classes issues des tokens, texte toujours présent

Référence réelle (T-010) : `apps/web/src/components/Alert/Alert.tsx` et `apps/web/src/components/Card/Card.tsx`. Une table `variante → classes de tokens`, aucun style en dur, et le sens porté par le texte, jamais par la seule couleur (`design/components.md`, section 1). `SlotStatusTag`, composant métier, suivra le même modèle avec le ticket d'écran qui le crée.

## 7. Composant avec action : chargement, erreur du catalogue, nom accessible

Références réelles (T-010) :
- `apps/web/src/components/Button/Button.tsx` : état `loading` (libellé conservé, action bloquée, jamais de double envoi).
- `apps/web/src/components/ConfirmDialog/ConfirmDialog.tsx` : une action asynchrone dont l'erreur d'API s'affiche avec le message du catalogue ; on décide sur le `code`, jamais sur le `message`.
- `apps/web/src/components/Form/Form.tsx` et `FormField/FormField.tsx` : erreurs de champ reliées par `aria-describedby`, `aria-invalid`.
- `apps/web/src/components/Toast/Toast.tsx` : retour d'une action (`useToast`).

Le bouton d'inscription (`RegisterButton`) reste à écrire avec T-014 ; il assemblera ces composants et rechargera l'état du créneau après chaque réponse (ADR-0008).

## Ce que ces extraits montrent

- Les règles sont dans le service, testables sans base, et citent leur règle (`RG-07`).
- Le code n'écrit ni message, ni couleur, ni heure « en dur ».
- Chaque couche ne connaît que celle du dessous : route → service → dépôt ; composant → client d'API.
- Un test par scénario, nommé avec son identifiant, au niveau le plus bas qui prouve la règle.
