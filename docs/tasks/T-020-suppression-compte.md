# T-020 : Suppression de son compte

Jalon : M5 – Compte, conformité et mise en service  
Fonctionnalités : F-11  
Dépend de : T-014, T-018, T-010  
Taille : une session de travail

## Objectif
Un utilisateur supprime son compte et ses données personnelles.

## À lire avant de commencer
- `user-stories.md` (« Suppression de son compte »)
- `domain/business-rules.md` (RG-04, RG-11)
- `flows/08-suppression-compte.mmd`
- `design/wireframes/04-membres-et-compte-*` (E1 à E3)
- `api/openapi.yaml` (`DELETE /me`)
- `architecture/security.md` (menace « suppression de compte incomplète »)

## Travail
- Service dans `members` : transaction qui supprime les inscriptions des créneaux non commencés, anonymise les autres (`userId` vide), supprime `ResetToken`, puis la ligne `User` entière.
- Refus immédiat pour le dernier administrateur (`USER_LAST_ADMIN`), sans écran de confirmation.
- Cookie effacé, retour à la page de connexion ; menu du prénom (E1), confirmation (E2), toast d'erreur (E3).

## Critères d'acceptation
- Les scénarios 1 à 4 de « Suppression de son compte » passent.
- Après suppression, aucune ligne de la base ne contient le nom, le prénom ni l'e-mail de la personne (test automatisé qui parcourt toutes les tables).
- L'inscription à un créneau commencé apparaît sous « ancien membre ».

## Tests attendus
- Intégration : nettoyage complet, anonymisation, dernier administrateur.
- E2E : scénarios 1 à 4.

## Hors périmètre
- Export des données (point ouvert de `security.md`, section 5).

Terminé quand : `definition-of-done.md` est entièrement cochée.
