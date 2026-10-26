# Stratégie de test – Créno

Statut : version 1.0 (2026-10-26). Découle de `architecture/architecture.md` (sections 2 et 5), `architecture/security.md` (section 4, tests de sécurité), `architecture/environments.md` (section 3) et `user-stories.md`. Outils décidés le 2026-10-26 : Vitest, Playwright, axe, et une vraie base PostgreSQL pour les tests d'intégration.

Principe : chaque scénario Given/When/Then d'une story et chaque règle de gestion (RG-xx) a un test. Le test se nomme avec son identifiant (`[F-07 S3] dernière place prise en même temps`, `RG-07 : capacité jamais dépassée`) pour retrouver la règle depuis le test, et inversement.

## 1. Pyramide

| Niveau | Outil | Ce qu'on y teste | Part visée |
| --- | --- | --- | --- |
| Unitaire | Vitest | Règles pures des services : états calculés (`status`, `started`, `full`), calcul du blocage de connexion, validation Zod, traduction des erreurs, masquage des journaux. Horloge injectée, aucune base | environ 60 % |
| Composant | Vitest + Testing Library | États des composants de `design/components.md` (chargement, vide, erreur, variantes), comportement des formulaires | environ 10 % |
| Intégration | Vitest + PostgreSQL réelle | Chaque route de `openapi.yaml` avec chaque rôle et chaque erreur, services avec la base, transactions, concurrence, migrations | environ 25 % |
| Bout en bout | Playwright | Les scénarios des stories sur un navigateur, en mobile (360 px) en priorité, et le scénario cible du MVP | environ 5 %, environ 25 parcours |
| Accessibilité | axe (dans Playwright) | Chaque écran, plus un contrôle manuel (section 6) | un balayage par écran |

Règle : tester au niveau le plus bas qui prouve la règle. Une règle de gestion se prouve d'abord en intégration ou en unitaire ; Playwright ne sert qu'à vérifier ce que l'utilisateur voit et fait.

## 2. Outils et organisation

- **Vitest** : deux projets, `unit` (rapide, sans base, lancé en continu) et `integration` (base). Commandes : `pnpm test` (les deux), `pnpm test:unit`, `pnpm test:integration`.
- **PostgreSQL réelle** : jamais de base simulée ni SQLite (la concurrence, les `CHECK` et l'index sur `lower(email)` dépendent de PostgreSQL, ADR-0002). En local, la base de `docker compose up -d db` avec une base `creno_test` distincte de celle de développement ; en intégration continue, un service PostgreSQL jetable.
- **Isolation** : migrations appliquées une fois ; chaque test commence par `TRUNCATE … RESTART IDENTITY CASCADE` sur les tables. Les fichiers d'intégration s'exécutent l'un après l'autre : les tests de concurrence ont besoin de transactions réellement validées, donc pas de « transaction annulée à la fin ».
- **Playwright** : application lancée sur une base de test amorcée par les fabriques ; Chromium, WebKit et Firefox en intégration continue, Chromium seul en local ; viewports 360 px et 1000 px (ceux des wireframes).
- **Dossiers** : tests unitaires à côté du code (`*.test.ts`), tests d'intégration dans `apps/web/tests/integration/`, bout en bout dans `apps/web/tests/e2e/`, fabriques dans `apps/web/tests/factories/`.
- **Horloge** : le service `shared` fournit `now()` ; les tests la figent (`2027-01-14T09:00:00Z`) pour tester les frontières exactes (créneau qui commence à l'instant, blocage de 15 minutes). Jamais d'attente réelle.

## 3. Seuils de couverture

Mesurés par Vitest en intégration continue ; la pull request échoue sous le seuil.

| Périmètre | Lignes | Branches |
| --- | --- | --- |
| Services métier (`modules/*/services`) | 90 % | 85 % |
| Couche API (enveloppe de route, erreurs) | 85 % | 80 % |
| Interface (composants) | 70 % | — |
| Ensemble du dépôt | 80 % | — |

Exclus du calcul : fichiers générés (tokens, `openapi.yaml`, `errors.*`), `seed`, pages de démonstration. La couverture n'est qu'un plancher : une règle de gestion sans test est un défaut même à 100 % de couverture.

## 4. Tests obligatoires (sécurité, concurrence, données)

Ils découlent de `architecture.md`, section 5, et de `security.md`, section 4 ; ils existent dès la tâche qui écrit la règle, pas en fin de projet.

| Test | Règle | Tâche |
| --- | --- | --- |
| **Concurrence sur la dernière place** : 50 requêtes d'inscription simultanées sur un créneau limité à 4 avec 3 inscrits ; exactement une réussit, la limite n'est jamais dépassée | RG-07 | T-014 |
| **Concurrence sur la capacité** : une inscription simultanée à un abaissement de limite ne laisse jamais plus d'inscrits que de places | RG-07 | T-012, T-014 |
| **Concurrence sur le dernier administrateur** : deux administrateurs qui se retirent le droit en même temps ; il en reste un | RG-04 | T-018 |
| **Concurrence sur l'installation** : deux `POST /setup` en parallèle ; un seul club et un seul administrateur | RG-17 | T-008 |
| **Concurrence sur le blocage** : 5 échecs simultanés comptent 5 | RG-03 | T-009 |
| **Accès refusé** : pour chaque route d'administration, un utilisateur et un visiteur reçoivent `403` ou `401`, rien n'est modifié (test paramétré sur le registre de routes) | RG-14 | chaque tâche de route |
| **Aucune donnée nominative après suppression de compte** : toutes les tables sont parcourues après `DELETE /me` | RG-11 | T-020 |
| **Pas de fuite d'existence de compte** : même réponse et même durée (à tolérance près) pour une adresse inconnue et un mauvais mot de passe | RG-03 | T-009 |
| **Contrat à jour** : `pnpm api:check` | ADR-0014 | T-005, T-006 |
| **Réponses conformes au contrat** : chaque réponse d'intégration est validée contre le schéma de `openapi.yaml` | ADR-0011 | T-004 |
| **Migrations** : appliquer, défaire, rejouer sur une base vide | `environments.md` §6 | T-002, T-006 |
| **Secrets** : aucun secret dans le dépôt, mots de passe et jetons absents des journaux | `security.md` | T-006, T-004 |

## 5. Des stories aux tests

Convention : un scénario de `user-stories.md` (par exemple « F-07, scénario 3 ») est couvert par un test nommé `[F-07 S3] …`. La matrice ci-dessous dit à quel niveau et dans quelle tâche ; elle est complétée en T-023.

| Story | Scénarios | Intégration (tâche) | E2E (tâche) | Remarques |
| --- | --- | --- | --- | --- |
| F-19 Installation | 1 à 5 | 1, 2, 3, 5 (T-008) | 1 à 4 (T-008) | Scénario 5 en concurrence : intégration seulement |
| F-02 Connexion | 1 à 6 et variantes | 1 à 3 ter, 5, 6 (T-009, T-018) | 1, 1 bis, 2, 3, 4 (T-009) ; 5 et 6 (T-019) | Blocage : unitaire avec horloge figée |
| F-03 Rôles | 1 à 4 | 2 (chaque tâche de route) | 1, 3, 4 (T-010) | |
| F-01 Invitation | 1 à 7 | 1 à 6 (T-017) | 1 à 7 (T-017) | |
| F-04 Événement | 1 à 8 | 1 à 8 (T-011) | 1 à 7 (T-013) | Scénario 8 (fuseau) : unitaire |
| F-05 Créneaux | 1 à 8 | 1 à 8 (T-012) | 1, 3 ter, 4, 6 (T-013) | |
| F-06 Consulter | 1 à 5 | 1 à 4 bis (T-014) | 1 à 5 (T-015) | |
| F-07 S'inscrire | 1 à 5 | 1 à 5 (T-014) | 1 à 4 ter (T-015) | Scénario 3 : concurrence en intégration, deux navigateurs en E2E |
| F-08 Désinscrire | 1 à 4 | 1 à 4 (T-014) | 1, 1 bis, 2 à 4 (T-015) | |
| F-09 Remplissage | 1 à 7 | 5 à 7 (T-014) | 1 à 7 (T-016) | |
| F-10 Membres | 1 à 8 | 1 à 8 (T-018) | 1 à 8 (T-019) | |
| F-11 Suppression | 1 à 4 | 1, 3, 4 (T-020) | 1 à 4 (T-020) | |

Un scénario qui ne peut pas être automatisé (par exemple « en moins de 3 minutes », « en moins de 2 minutes depuis un téléphone ») est une ligne de recette manuelle dans T-023, avec le résultat mesuré.

## 6. Accessibilité (WCAG 2.2 AA, ADR-0007)

- **Automatique** : axe sur chaque écran et chaque état important (formulaire en erreur, boîte de confirmation ouverte) en 360 px et 1000 px ; aucune violation « sérieuse » ou « critique ».
- **Manuel, avant la première mise en ligne** (T-021), sur connexion, liste des événements, inscription à un créneau, création d'événement :
  - clavier seul : tout est atteignable, l'ordre du focus est logique, le focus est visible, aucun piège ;
  - lecteur d'écran (VoiceOver et un second) : titres, noms des champs, annonce des erreurs et des toasts, nom des boutons « Je m'inscris » par créneau ;
  - zoom à 200 % et texte agrandi : rien ne se chevauche ;
  - contraste : valeurs des tokens vérifiées une fois à la création de `tokens.json`, puis contrôlées par axe.
- Le rapport est noté dans la pull request de T-021.

## 7. Jeux de données

- **Fabriques** (`tests/factories/`) : `buildUser`, `buildEvent`, `buildSlot`, `buildRegistration`, … produisent des objets valides avec des valeurs par défaut explicites ; un test ne précise que ce qui compte pour lui.
- **`seed` de développement** (T-002) : un club « Ski Club des Arcs » (Europe/Paris), un administrateur, deux utilisateurs, trois événements (à venir, en cours, passé) avec créneaux limités, illimités, complet, vide, commencé ; décrit dans `README.md`.
- **Données fictives uniquement** : adresses en `@exemple.fr`, noms inventés, jamais de données de production, jamais de sauvegarde réelle dans les tests.
- **Dates** : toujours relatives à l'horloge figée, jamais à la date du jour.

## 8. Intégration continue

Chaque pull request exécute dans l'ordre : lint, types, tests unitaires, tests d'intégration (PostgreSQL jetable, migrations appliquées-défaites-rejouées), `pnpm api:check`, E2E et axe, seuils de couverture, scan de secrets, audit des dépendances (`environments.md`, section 3). Un test instable est corrigé ou supprimé dans la semaine, jamais ignoré en silence.
