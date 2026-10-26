# T-016 : Interface administrateur : suivi du remplissage et retrait d'inscrit

Jalon : M3 – Inscriptions (bénévole) et suivi du remplissage  
Fonctionnalités : F-09  
Dépend de : T-013, T-014, T-015  
Taille : une session de travail

## Objectif
Voir en un écran qui est inscrit à chaque créneau et retirer un inscrit.

## À lire avant de commencer
- `user-stories.md` (« Vue administrateur du remplissage »)
- `flows/06-admin-suivi-remplissage.mmd`
- `design/wireframes/03-admin-evenements-*` (C2, C10)
- `design/components.md` (SlotCard `admin`, AttendeeChip `removable`, ConfirmDialog `remove-registration`)

## Travail
- Page d'événement côté administrateur : pour chaque créneau les inscrits, « 3 / 4 », « 0 / 6 », « 2 inscrits », alerte « Aucun inscrit » pour un créneau limité vide (C2).
- Retrait d'un inscrit avec confirmation nommant la personne (C10), y compris sur un créneau commencé.
- Événement passé : lecture seule, sans bouton « Retirer ».

## Critères d'acceptation
- Les 7 scénarios de F-09 passent.
- Les trois créneaux de l'exemple (limité à 3/4, limité à 0/6, illimité à 2) tiennent sur un seul écran mobile défilable, sans changer de page.

## Tests attendus
- E2E : scénarios 1 à 7 ; accessibilité axe.

## Hors périmètre
- Inscription d'un bénévole par l'administrateur (F-12, v1.1), vue calendrier (F-18).

Terminé quand : `definition-of-done.md` est entièrement cochée.
