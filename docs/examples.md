# Exemples de code de référence – Créno

Statut : version 1.0 (2026-10-26). Extraits courts du style attendu, tous sur le même cas : **s'inscrire à un créneau** (F-07, RG-07, RG-08, RG-09, RG-15, `POST /slots/{slotId}/registrations`). Ils appliquent `conventions.md`. Les sections 1 à 5 renvoient vers le code réel de T-014 ; les sections 6 et 7 vers celui de T-010. Quand le vrai code existe, la tâche qui l'écrit remplace l'extrait correspondant par un renvoi vers le fichier réel, qui devient la référence.

## 1. Schéma de validation (`packages/validation`)

Référence réelle (T-004, T-012) : `packages/validation/src/schemas/events.ts` (`slotInputSchema`, `slotIdParamsSchema`). Des codes de champ, jamais de texte (ADR-0009) ; le type se déduit du schéma.

## 2. Route d'API

Référence réelle (T-014) : `apps/web/src/app/api/slots/[slotId]/registrations/route.ts`. Mince : authentification, validation, un appel de service. Aucune règle ici.

## 3. Service : règles pures, puis transaction

Référence réelle (T-014) : `apps/web/src/modules/registrations/registrations.service.ts`. Les règles (`assertCanRegister`, `assertSlotNotStarted`, `assertEventOpen`) sont des fonctions pures testables sans base ; le service orchestre. L'heure vient de l'horloge injectée.

Le mécanisme de verrouillage de RG-07 est fixé par T-014 : un verrou de ligne sur le créneau, pris en première instruction de la transaction (voir `architecture/architecture.md`, section 5). La vérification et l'écriture sont dans la même transaction.

## 4. Dépôt : accès aux données, aucune règle

Référence réelle (T-014) : `apps/web/src/modules/registrations/registrations.repository.ts` (`inSlotTransaction`). Le dépôt ouvre la transaction et pose le verrou ; la décision reste dans le service.

## 5. Tests

Références réelles (T-014) :
- Unitaire, règle pure, horloge figée, frontière exacte : `apps/web/src/modules/registrations/registrations.service.test.ts`.
- Intégration, route, base réelle, concurrence (50 requêtes sur la dernière place, inscription simultanée à un abaissement de limite) : `apps/web/tests/integration/registrations.test.ts`.

## 6. Composant : classes issues des tokens, texte toujours présent

Référence réelle (T-010) : `apps/web/src/components/Alert/Alert.tsx` et `apps/web/src/components/Card/Card.tsx`. Une table `variante → classes de tokens`, aucun style en dur, et le sens porté par le texte, jamais par la seule couleur (`design/components.md`, section 1). `SlotStatusTag`, composant métier, suivra le même modèle avec le ticket d'écran qui le crée.

## 7. Composant avec action : chargement, erreur du catalogue, nom accessible

Références réelles (T-010) :
- `apps/web/src/components/Button/Button.tsx` : état `loading` (libellé conservé, action bloquée, jamais de double envoi).
- `apps/web/src/components/ConfirmDialog/ConfirmDialog.tsx` : une action asynchrone dont l'erreur d'API s'affiche avec le message du catalogue ; on décide sur le `code`, jamais sur le `message`.
- `apps/web/src/components/Form/Form.tsx` et `FormField/FormField.tsx` : erreurs de champ reliées par `aria-describedby`, `aria-invalid`.
- `apps/web/src/components/Toast/Toast.tsx` : retour d'une action (`useToast`).

Référence réelle (T-015) : `apps/web/src/components/SlotCard/SlotCard.tsx` (variante `volunteer`, bouton « Je m'inscris » nommé par créneau) et `apps/web/src/app/(app)/events/_screens/EventScreen.tsx`, qui assemble ces composants et relit l'événement après chaque réponse (ADR-0008).

## Ce que ces extraits montrent

- Les règles sont dans le service, testables sans base, et citent leur règle (`RG-07`).
- Le code n'écrit ni message, ni couleur, ni heure « en dur ».
- Chaque couche ne connaît que celle du dessous : route → service → dépôt ; composant → client d'API.
- Un test par scénario, nommé avec son identifiant, au niveau le plus bas qui prouve la règle.
