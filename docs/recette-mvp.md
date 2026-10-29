# Recette du MVP – Créno

Statut : compte rendu de T-023, établi le 2026-10-28 sur `main` (après T-025). **Mise à jour du 2026-10-29** : le MVP inclut désormais F-22, les créneaux libres (T-026, [#65](https://github.com/nathanjouannon/Creno/issues/65)), développée après ce compte rendu ; ses scénarios sont ajoutés à la recette automatisée (section 1) et à la matrice (section 2). Les parties automatisées sont exécutées ; la recette manuelle sur appareils réels reste **à faire par une personne** (section 4).

## 1. Scénario cible de bout en bout

`apps/web/tests/e2e/mvp-scenario.spec.ts` (`[MVP]`), joué en 360 px sur la version de production : installation de l'instance (F-19), création d'un événement avec un créneau limité à 2 et un créneau illimité (F-04, F-05), lien d'invitation (F-01), trois bénévoles qui créent leur compte depuis le lien (F-01) et s'inscrivent (F-07), créneau « Complet » pour le troisième (RG-07), suivi du remplissage par l'administrateur (F-09), retrait d'un inscrit, hausse de la limite, inscription des places libérées. **Résultat : vert.**

F-22 (T-026) : `apps/web/tests/e2e/free-slots.spec.ts`, en 360 px (et 1000 px pour l'accessibilité) : événement en créneaux fixes inchangé, parcours bénévole en créneaux libres (choix des horaires, durée trop courte, recouvrement, désinscription) et en mode « les deux », saisie au clavier, suivi et retrait par l'administrateur, création en créneaux libres, changement de mode refusé puis accepté, axe sur B8 à C11. **Résultat : vert**, et suite E2E complète verte (119 tests).

## 2. Matrice « scénario de story → test »

Relevé automatique : pour chaque scénario du MVP (F-01 à F-11, F-19) plus F-20, F-21 et F-22, présence de son identifiant (`[F-xx Sn]`) dans un test.

- Au départ, 3 scénarios sans identifiant : F-03 S2 (couvert sans étiquette par le test « POST, PATCH et DELETE answer 403 »), F-05 S2 (même cas que F-07 S2) et l'intégration de F-06. Les tests ont été renommés ; aucun test ajouté, aucun comportement manquant.
- Résultat : **tous les scénarios MVP portent leur identifiant dans au moins un test d'intégration, unitaire ou E2E** (relevé reproductible par recherche des étiquettes `[F-xx Sn]`). Les écarts de niveau avec la matrice (par exemple un scénario d'interface couvert en E2E et en composant seulement) suivent la règle « tester au niveau le plus bas qui prouve la règle ».
- F-22 : les 25 scénarios portent leur identifiant dans au moins un test (relevé du 2026-10-29) ; détail par niveau dans `testing.md`, section 5.
- Aucun scénario ne demande une ligne de recette manuelle « non automatisable » : les stories ne fixent pas de durée à mesurer.

## 3. Exigences non fonctionnelles (`architecture.md`, section 2)

Mesure : `apps/web/scripts/perf-check.ts`, sur la version de production en local (macOS, PostgreSQL en conteneur), 20 utilisateurs simultanés. Mesure indicative sur une machine de développement, à refaire sur le serveur réel.

| Exigence                                              | Cible                       | Résultat                                                         |
| ----------------------------------------------------- | --------------------------- | ---------------------------------------------------------------- |
| 95 % des requêtes sous 1 s                            | p95 < 1000 ms               | **53 ms** (420 requêtes)                                         |
| Inscription à un créneau                              | < 500 ms                    | p95 **197 ms**, max 201 ms (20 inscriptions simultanées)         |
| LCP mobile en 4G (360 px, CPU ×4, 1,6 Mbit/s, 150 ms) | < 2,5 s                     | connexion **464 ms**, liste **248 ms**, événement **624 ms**     |
| Concurrence (RG-07)                                   | jamais au-delà de la limite | 20 demandes sur 15 places : 15 créées, 5 « complet », 15 en base |

Test de charge léger : 20 utilisateurs, une inscription chacun en même temps sur un créneau limité à 15, puis 10 lectures chacun de la liste et du détail. Pas d'erreur 5xx.

Commande : instance neuve (non installée), puis `BASE_URL=… DATABASE_URL=… pnpm --filter @creno/web exec tsx scripts/perf-check.ts`.

## 4. Recette manuelle (à faire)

À remplir par une personne ; non réalisable depuis l'environnement de développement.

| Appareil / navigateur          | Connexion | Liste | Inscription | Création d'événement | Créneau libre (saisie des heures) | Résultat |
| ------------------------------ | --------- | ----- | ----------- | -------------------- | --------------------------------- | -------- |
| iPhone (Safari iOS récent)     |           |       |             |                      |                                   |          |
| Android (Chrome)               |           |       |             |                      |                                   |          |
| Chrome (2 dernières versions)  |           |       |             |                      |                                   |          |
| Safari (2 dernières versions)  |           |       |             |                      |                                   |          |
| Firefox (2 dernières versions) |           |       |             |                      |                                   |          |
| Edge (2 dernières versions)    |           |       |             |                      |                                   |          |

Contrôles d'accessibilité manuels de T-021 (clavier, lecteur d'écran, zoom 200 %) : voir le rapport de la pull request de T-021.

## 5. Tâches M0 à M5

T-001 à T-022, T-024 et T-025 sont fermées ; T-026 (M6) est livrée par sa pull request. Reste ouvert hors recette : l'issue #62 (client Prisma périmé après migration, procédure de développement, sans effet sur la production dont le build génère le client).

## 6. Décision de mise en service

**Mise en service conditionnelle** : aucun défaut bloquant côté automatisé (scénarios, concurrence, performance). Elle devient définitive quand (1) la section 4 est remplie sans défaut bloquant, (2) la mesure de la section 3 est refaite sur le serveur de production, (3) la liste de `definition-of-done.md` est cochée dans la pull request. Tout écart relevé devient un ticket avec sa priorité.
