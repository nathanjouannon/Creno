# ADR-0016 : Créneaux libres et mode d'inscription d'un événement

Statut : proposée (2026-10-29), à valider avec la pull request de documentation de F-22. Les points 1 à 4 de la décision viennent du propriétaire du produit ; les autres sont des propositions de l'auteur de la documentation, marquées « proposé ».

## Contexte
Au MVP, un bénévole s'inscrit seulement à un créneau défini par l'administrateur (`Slot`). Certains événements n'ont pas de découpage naturel : l'administrateur veut que chacun donne le temps qu'il a, de telle heure à telle heure. Le ticket T-026 ([#65](https://github.com/nathanjouannon/Creno/issues/65)) demande trois modes par événement : créneaux fixes (comportement actuel), créneaux libres (le bénévole crée lui-même sa plage), ou les deux.

Cela remet en cause le modèle `Registration` (un lien `userId`–`slotId`), le glossaire et RG-07, RG-08, RG-10. Aucun autre ADR n'est modifié : l'ADR-0003 (identifiants entiers), l'ADR-0008 (pas de temps réel) et l'ADR-0014 (contrat généré depuis Zod) restent valables.

## Décision
1. **Modèle de données** : un créneau libre est une `Registration` sans créneau fixe. La colonne `slot_id` devient facultative ; la ligne porte `event_id`, `starts_at` et `ends_at`. Une contrainte `CHECK` impose l'une des deux formes, jamais un mélange : créneau fixe (`slot_id` seul) ou créneau libre (`event_id`, `starts_at`, `ends_at`, durée d'au moins 30 minutes). La clé d'unicité `(slot_id, user_id)` est inchangée ; les `NULL` ne se comparent pas, elle ne gêne donc pas les créneaux libres. Aucun `Slot` n'est créé en coulisse.
2. **Vocabulaire** : « créneau libre » (`freeSlot`) ; « créneau » seul reste un `Slot` (`glossary.md`). Le risque de confusion entre `Slot` et `freeSlot` est connu et accepté ; il est compensé par la règle « ne jamais nommer un créneau libre `Slot` » et par le titre « Créneaux proposés » côté interface. Dans l'API, un créneau libre est exposé sous le nom `FreeSlot`, ce n'est pas une `Registration` brute.
3. **Capacité** : aucune. Un créneau libre est toujours inscriptible, jamais « complet » ; RG-07 ne s'applique qu'aux créneaux fixes. Aucune concurrence sur les places n'est ajoutée.
4. **Bornes** : les horaires restent dans les dates de l'événement, durée minimale de 30 minutes, pas de durée maximale, plusieurs créneaux libres par bénévole et par événement à condition qu'ils ne se recouvrent pas (RG-20).
5. **Mode d'inscription** (proposé) : une colonne `events.registration_mode`, énumération `FIXED` (défaut), `FREE`, `BOTH`, plutôt que deux cases à cocher : trois états valides, la combinaison « aucun des deux » est impossible par construction. Les événements existants passent en `FIXED` par la valeur par défaut de la migration, sans toucher aux données.
6. **Cohérence mode / contenu** (proposé) : un mode n'accepte que ses types de créneaux. Changer de mode est refusé tant que l'événement contient un type que le nouveau mode n'accepte pas ; l'administrateur supprime d'abord ces créneaux (RG-10). C'est plus strict que le ticket (« refus tant que des inscriptions du mode retiré existent ») : on interdit aussi un créneau fixe vide dans un événement `FREE`, pour qu'un événement n'ait jamais de contenu invisible ou inatteignable.
7. **Créneaux fixes indicatifs en `BOTH`** (proposé) : ils restent inscriptibles avec leur limite et leurs règles de temps (RG-07, RG-08). « Indicatif » signifie que le bénévole n'est pas obligé de les choisir. Les créneaux libres ne comptent pas dans leur remplissage, même si les horaires se recouvrent : pas de calcul croisé, pas d'état « complet » qui dépende d'une autre table.
8. **Un créneau libre ne se modifie pas** (proposé) : il se supprime et se recrée. Cela évite une route et un formulaire de modification et reprend le changement de créneau de F-08 (se désinscrire, puis s'inscrire).
9. **Concurrence** (proposé) : la création d'un créneau libre, le changement de mode et la création d'un créneau fixe commencent par le même verrou de ligne sur l'événement (un `UPDATE` qui ne change rien, voir `architecture.md`, section 5), puis lisent le mode et les créneaux libres du même utilisateur avant d'écrire. Cela garantit sans SQL brut qu'une demande simultanée ne produit ni deux créneaux libres qui se recouvrent, ni un créneau créé dans un mode qui ne l'accepte plus. Les inscriptions à un créneau fixe continuent de ne verrouiller que leur créneau : aucune régression sur RG-07.

## Alternatives écartées
- **Créer un `Slot` d'une place à chaque inscription libre** : ne change pas le modèle, mais remplit la liste des créneaux de l'administrateur de créneaux qu'il n'a pas créés, brouille la distinction fixe / libre et fausse « Créneau vide » et les compteurs.
- **Table séparée `free_slots`** : un seul lien utilisateur-horaires serait dupliqué ; la suppression de compte (RG-11), l'anonymisation et la suppression en cascade (RG-10) seraient à écrire deux fois.
- **Deux cases à cocher au lieu d'un mode** : permet l'état « aucun des deux », qu'il faudrait refuser ailleurs.
- **Contrainte d'exclusion PostgreSQL contre le recouvrement** (`EXCLUDE USING gist`, extension `btree_gist`) : exigerait une extension et du SQL spécifique à PostgreSQL dans la migration ; le verrou de ligne de la décision 9 suffit pour un événement de moins de 200 inscrits.
- **Capacité simultanée sur les créneaux libres** : renvoyée au besoin réel ; elle demanderait un calcul de recouvrement et de verrouillage plus coûteux, sans demande actuelle.

## Conséquences
- (+) Les événements existants et le mode `FIXED` ne changent pas de comportement ; une seule migration additive (colonne avec défaut, colonne devenue facultative, trois colonnes facultatives, une contrainte, un index).
- (+) Retrait par l'administrateur, suppression de compte, suppression d'événement, anonymisation et lecture seule des événements passés réutilisent les routes et règles de `Registration` avec peu de changements (RG-10, RG-11, RG-15).
- (-) `registrations.slot_id` n'est plus `NOT NULL` : tout code qui lit `registration.slot` doit traiter le cas vide. Les dépôts exposent deux lectures distinctes (inscriptions de créneaux fixes, créneaux libres).
- (-) Le verrou de ligne sur l'événement sérialise les créations de créneaux libres d'un même événement : acceptable à 20 utilisateurs simultanés (`architecture.md`, section 2) ; à mesurer par le test de concurrence de T-026.
- (-) F-12 (inscription par un administrateur), F-13 (journal), F-14 (« Mon planning ») et F-16 (heures) devront traiter les deux formes d'inscription : F-14 et F-16 listent les créneaux libres avec leurs propres horaires.

## Contrat d'API prévu (entrée de T-026)
`api/openapi.yaml`, `api/errors.md` et `api/errors.json` sont générés (ADR-0014) : ils ne se modifient pas à la main. T-026 déclare les schémas Zod et le registre de routes suivants dans `packages/validation`, puis régénère ces fichiers, et ce chapitre cède alors la place au contrat généré.

**Schémas modifiés**
- `EventInput`, `EventUpdate`, `EventSummary`, `EventDetail` : champ `registrationMode` (`FIXED`, `FREE`, `BOTH`) ; à la création, `FIXED` s'il est absent.
- `EventDetail` : tableau `freeSlots` de `FreeSlot`, trié par début, fin puis `id` croissants ; vide en mode `FIXED`.
- Nouveau `FreeSlot` : `id` (identifiant de l'inscription), `eventId`, `startsAt`, `endsAt`, `started` (calculé, RG-08), `displayName` (« Prénom N. », `null` si anonymisé), `isMe`.
- Nouveau `FreeSlotInput` : `startsAt`, `endsAt`.

**Routes**

| Route | Authentification | Rôle | Réponses |
| --- | --- | --- | --- |
| `POST /events/{eventId}/free-slots` | utilisateur (administrateur compris) | Crée le créneau libre de l'utilisateur connecté | `201` `FreeSlot` ; `400` `VALIDATION_ERROR` ; `401` ; `404` `EVENT_NOT_FOUND` ; `409` `EVENT_FREE_SLOTS_NOT_ALLOWED`, `FREE_SLOT_OVERLAP`, `EVENT_PAST` |
| `DELETE /free-slots/{freeSlotId}` | utilisateur | Supprime son propre créneau libre (se désinscrire) | `204` ; `401` ; `404` `FREE_SLOT_NOT_FOUND` (inconnu, d'un autre utilisateur, ou événement passé vu par un utilisateur) ; `409` `FREE_SLOT_STARTED`, `EVENT_PAST` |
| `DELETE /registrations/{registrationId}` (existante) | administrateur | Retire le créneau libre d'un autre, `registrationId` = `FreeSlot.id` ; inchangée | comme aujourd'hui |

`PATCH /events/{eventId}` accepte `registrationMode` ; il ajoute les réponses `409` `EVENT_MODE_HAS_SLOTS` et `EVENT_MODE_HAS_FREE_SLOTS`. `POST /events/{eventId}/slots` et `POST /events` (avec des créneaux dans le corps) ajoutent `409` `EVENT_FIXED_SLOTS_NOT_ALLOWED`. Les routes de `/slots/{slotId}/registrations` ne changent pas.

**Codes d'erreur à ajouter au catalogue**

| Code | HTTP | Message | Cause | Détails |
| --- | --- | --- | --- | --- |
| `EVENT_FREE_SLOTS_NOT_ALLOWED` | 409 | Cet événement ne propose pas de créneaux libres. | RG-19 : mode `FIXED` | |
| `EVENT_FIXED_SLOTS_NOT_ALLOWED` | 409 | Cet événement ne propose que des créneaux libres. | RG-19 : mode `FREE` | |
| `EVENT_MODE_HAS_SLOTS` | 409 | Pour passer en créneaux libres, supprime d'abord les créneaux fixes ({slotCount}). | RG-19 | `slotCount` |
| `EVENT_MODE_HAS_FREE_SLOTS` | 409 | Pour passer en créneaux fixes, supprime d'abord les créneaux libres ({freeSlotCount}). | RG-19 | `freeSlotCount` |
| `FREE_SLOT_NOT_FOUND` | 404 | Créneau libre introuvable. | Identifiant inconnu, ou d'un autre utilisateur | |
| `FREE_SLOT_OVERLAP` | 409 | Tu as déjà des horaires qui recouvrent ceux-ci. | RG-20 | `freeSlotId` (celui qui recouvre) |
| `FREE_SLOT_STARTED` | 409 | Ce créneau libre a commencé. Contacte un administrateur pour modifier ton inscription. | RG-08, RG-20 | `freeSlotId` |

Codes de champ (`VALIDATION_ERROR`) : `FIELD_FREE_SLOT_OUT_OF_EVENT` (« Les horaires doivent rester dans les dates de l'événement. », sur `startsAt` ou `endsAt`), `FIELD_FREE_SLOT_TOO_SHORT` (« Un créneau libre dure au moins 30 minutes. », sur `endsAt`), `FIELD_START_NOT_IN_FUTURE` (« Choisis une heure de début à venir. », sur `startsAt`), `FIELD_REGISTRATION_MODE_INVALID` (« Choisis un mode d'inscription de la liste. »). `FIELD_END_NOT_AFTER_START` et `FIELD_DATE_INVALID` existent déjà. Les trois premiers dépendent de l'événement ou de l'heure courante : ils sont produits par le service, pas par le seul schéma Zod (ADR-0014, dernière conséquence).

## Documents mis à jour avec cet ADR
`prd.md` (F-22), `user-stories.md`, `domain/business-rules.md` (RG-19, RG-20), `glossary.md`, `domain/schema.sql` et `erd.mmd`, `architecture/architecture.md`, `flows/` (04, 05, 06, 10), `design/components.md`, `design/wireframes/05-creneaux-libres.md`, `testing.md`, `roadmap.md`.
