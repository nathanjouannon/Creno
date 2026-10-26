# T-023 : Recette de bout en bout du MVP

Jalon : M5 – Compte, conformité et mise en service  
Fonctionnalités : F-01 à F-11, F-19  
Dépend de : T-008, T-009, T-013, T-015, T-016, T-017, T-019, T-020, T-021  
Taille : une session de travail

## Objectif
Valider le scénario cible du MVP et décider de la mise en service.

## À lire avant de commencer
- `prd.md` (section 5, MVP ; section 8, indicateurs)
- `user-stories.md` (toutes les stories du MVP)
- `testing.md`
- `definition-of-done.md`

## Travail
- Test E2E du scénario cible : installer, inviter, créer un événement avec créneaux, inscrire des bénévoles, ajuster, suivre le remplissage.
- Passer en revue la matrice « scénario de story → test » de `testing.md`, section 5 ; compléter les scénarios non couverts.
- Recette manuelle sur téléphone réel (iOS et Android) et sur les deux dernières versions de Chrome, Safari, Firefox, Edge.
- Vérifier les exigences non fonctionnelles de `architecture.md`, section 2 (95 % des requêtes sous 1 s, inscription sous 500 ms, LCP sous 2,5 s en 4G) avec une mesure simple et noter les résultats.
- Rédiger le compte rendu de recette et la décision de mise en service.

## Critères d'acceptation
- Tous les scénarios Given/When/Then des stories MVP sont couverts par un test automatisé ou une ligne de recette manuelle justifiée.
- La liste « Prêt à développer » devient « prêt à livrer » : toutes les tâches M0 à M5 sont fermées et leur définition de « terminé » est cochée.
- Les écarts éventuels sont des tickets ouverts avec une priorité, pas des oublis.

## Tests attendus
- E2E du scénario cible ; test de charge léger (20 utilisateurs simultanés) sur l'inscription.

## Hors périmètre
- Fonctionnalités v1.1 et v2.

Terminé quand : `definition-of-done.md` est entièrement cochée.
