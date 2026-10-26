# T-013 : Interface administrateur : événements et créneaux

Jalon : M2 – Événements et créneaux (administrateur)  
Fonctionnalités : F-04, F-05  
Dépend de : T-010, T-011, T-012  
Taille : une session de travail

## Objectif
Les administrateurs gèrent les événements et créneaux depuis l'interface.

## À lire avant de commencer
- `user-stories.md` (F-04, F-05)
- `flows/05-admin-evenements-creneaux.mmd`
- `design/wireframes/03-admin-evenements-*` (C1, C4 à C9)
- `design/components.md` (EventListItem, EventForm, SlotForm, SlotCard `admin`, EventHeader, ConfirmDialog)
- `api/openapi.yaml`

## Travail
- Liste des événements à venir (C1) et passés (C9) avec EmptyState.
- Formulaire d'événement (C4, C5) avec créneaux, titre obligatoire, fin après début.
- Formulaire de créneau (C6, C7) avec avertissement « Ce créneau est hors des dates de l'événement » calculé côté interface (RG-07).
- Suppression d'un événement ou d'un créneau (C8) : confirmation avec nombre d'inscrits, immédiate sans inscrit (RG-10).
- Page d'un événement passé en lecture seule : aucun bouton de modification (RG-15).
- États de chargement, vide et erreur ; mobile 360 px.

## Critères d'acceptation
- Les scénarios de F-04 et F-05 qui concernent l'écran passent (E2E), y compris 5 et 6 (confirmation) et 7 (lecture seule).
- Un champ invalide affiche le message du catalogue sous le champ et conserve les valeurs saisies.
- Un administrateur crée un événement avec créneau en moins de 3 minutes (mesure manuelle notée dans la pull request).

## Tests attendus
- E2E : création avec et sans créneau, modification, suppression avec et sans inscrit, créneau hors dates, événement passé.
- Accessibilité : axe sur chaque écran.

## Hors périmètre
- Remplissage et retrait d'inscrit (T-016), invitation (T-017).

Terminé quand : `definition-of-done.md` est entièrement cochée.
