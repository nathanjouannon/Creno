# Feuille de route – Créno

Statut : version 1.0 (2026-10-26). Découle de `prd.md` (MVP : F-01 à F-11 et F-19), de `architecture/architecture.md` et de `api/openapi.yaml`. Les tâches sont des tickets GitHub (voir `tasks/README.md`) ; le contenu de chaque tâche est dans son issue.

Principe : un squelette qui tourne de bout en bout d'abord (M0), puis des tranches verticales : chaque jalon livre quelque chose d'utilisable, de la base de données à l'interface. Une tâche tient en une session de travail et cite les fichiers à lire.

## 1. Jalons

| Jalon | Ce qui est livré | Tâches | Fonctionnalités |
| --- | --- | --- | --- |
| **M0 – Squelette** | Un dépôt qui se lance, passe ses tests, se construit en image Docker et applique ses migrations ; contrat d'API généré depuis Zod ; style généré depuis les tokens ; `/health` | T-001 à T-006 | — |
| **M1 – Installation et accès** | Installer une instance, se connecter, se déconnecter, pages protégées par rôle, composants de base | T-007 à T-010 | F-19, F-02, F-03 |
| **M2 – Événements et créneaux** | L'administrateur crée, modifie et supprime des événements et des créneaux, avec une description facultative par créneau (T-024, ajoutée après T-013) | T-011 à T-013, T-024 | F-04, F-05, F-21 |
| **M3 – Inscriptions** | Les bénévoles consultent et s'inscrivent ; l'administrateur suit le remplissage et retire un inscrit | T-014 à T-016 | F-06, F-07, F-08, F-09 |
| **M4 – Invitations et membres** | Inviter par lien, créer son compte, gérer les membres et les droits, réinitialiser un mot de passe | T-017 à T-019 | F-01, F-10, F-02 (réinitialisation) |
| **M5 – Compte et mise en service** | Suppression de compte, conformité RGPD et accessibilité, sauvegardes et exploitation, recette du MVP | T-020 à T-023 | F-11 |

À la fin de M3, il manque seulement l'invitation pour utiliser Créno avec des bénévoles réels : on peut créer les premiers comptes par le `seed` ou la base en attendant M4. La mise en service pour un club réel n'a lieu qu'après M5.

## 2. Tâches

| N° | Ticket | Jalon | Fonctionnalités | Dépend de |
| --- | --- | --- | --- | --- |
| T-001 | [Monorepo pnpm, Next.js, outils de qualité](https://github.com/nathanjouannon/Creno/issues/1) | M0 | — | — |
| T-002 | [Base PostgreSQL, schéma Prisma, migrations avec retour, jeu de données](https://github.com/nathanjouannon/Creno/issues/2) | M0 | — | T-001 |
| T-003 | [Tokens de design vers variables CSS et thème Tailwind](https://github.com/nathanjouannon/Creno/issues/3) | M0 | — | T-001 |
| T-004 | [Socle API : erreurs, validation, journaux, santé](https://github.com/nathanjouannon/Creno/issues/4) | M0 | — | T-001, T-002 |
| T-005 | [Schémas Zod du contrat et génération d'OpenAPI et du catalogue](https://github.com/nathanjouannon/Creno/issues/5) | M0 | — | T-004 |
| T-006 | [Image Docker, compose de production et intégration continue](https://github.com/nathanjouannon/Creno/issues/6) | M0 | — | T-002, T-003, T-005 |
| T-007 | [Authentification : mots de passe, JWT, session, protections](https://github.com/nathanjouannon/Creno/issues/7) | M1 | F-02, F-03 | T-004 |
| T-008 | [Installation de l'instance : club et premier administrateur](https://github.com/nathanjouannon/Creno/issues/8) | M1 | F-19 | T-002, T-004, T-007 |
| T-009 | [Connexion, déconnexion et blocage par adresse saisie](https://github.com/nathanjouannon/Creno/issues/9) | M1 | F-02 | T-007 |
| T-010 | [Structure de page, composants de base et protection des pages](https://github.com/nathanjouannon/Creno/issues/10) | M1 | F-03 | T-003, T-007 |
| T-011 | [Événements : services et routes](https://github.com/nathanjouannon/Creno/issues/11) | M2 | F-04 | T-004, T-005, T-007 |
| T-012 | [Créneaux : services et routes](https://github.com/nathanjouannon/Creno/issues/12) | M2 | F-05 | T-011 |
| T-013 | [Interface administrateur : événements et créneaux](https://github.com/nathanjouannon/Creno/issues/13) | M2 | F-04, F-05 | T-010, T-011, T-012 |
| T-014 | [Inscriptions : services et routes, concurrence](https://github.com/nathanjouannon/Creno/issues/14) | M3 | F-06, F-07, F-08 | T-011, T-012 |
| T-015 | [Interface bénévole : consulter, s'inscrire, se désinscrire](https://github.com/nathanjouannon/Creno/issues/15) | M3 | F-06, F-07, F-08 | T-010, T-014 |
| T-016 | [Interface administrateur : suivi du remplissage et retrait d'inscrit](https://github.com/nathanjouannon/Creno/issues/16) | M3 | F-09 | T-013, T-014, T-015 |
| T-017 | [Invitations : lien, création de compte](https://github.com/nathanjouannon/Creno/issues/17) | M4 | F-01 | T-008, T-011, T-010 |
| T-018 | [Membres, rôles, réinitialisation du mot de passe : services et routes](https://github.com/nathanjouannon/Creno/issues/18) | M4 | F-10, F-02 | T-007, T-009 |
| T-019 | [Interface : membres et réinitialisation du mot de passe](https://github.com/nathanjouannon/Creno/issues/19) | M4 | F-10, F-02 | T-010, T-018 |
| T-020 | [Suppression de son compte](https://github.com/nathanjouannon/Creno/issues/20) | M5 | F-11 | T-014, T-018, T-010 |
| T-021 | [Mentions d'information et accessibilité](https://github.com/nathanjouannon/Creno/issues/21) | M5 | F-11 | T-015, T-016, T-019, T-020 |
| T-022 | [Sauvegardes, purges, supervision et mise en production](https://github.com/nathanjouannon/Creno/issues/22) | M5 | — | T-006, T-009, T-018 |
| T-023 | [Recette de bout en bout du MVP](https://github.com/nathanjouannon/Creno/issues/23) | M5 | F-01 à F-11, F-19, F-21 | T-008, T-009, T-013, T-015, T-016, T-017, T-019, T-020, T-021 |
| T-024 | [Description d'un créneau](https://github.com/nathanjouannon/Creno/issues/54) | M2 | F-21 | T-013, T-015 |

Fonctionnalités de `prd.md` au MVP et la tâche qui les termine : F-01 → T-017 ; F-02 → T-009 et T-019 ; F-03 → T-010 et chaque tâche de route ; F-04 → T-013 ; F-05 → T-013 ; F-06 à F-08 → T-015 ; F-09 → T-016 ; F-10 → T-019 ; F-11 → T-020 ; F-19 → T-008 ; F-21 → T-024.

## 3. Ordre et parallélisme

Ordre conseillé (les dépendances exactes sont dans le tableau) :

1. M0 : T-001, puis T-002 et T-003, puis T-004, T-005, T-006.
2. M1 : T-007, puis T-008, T-009 et T-010.
3. M2 : T-011, T-012, T-013.
4. M3 : T-014, T-015, T-016.
5. M4 : T-017 ; T-018, T-019.
6. M5 : T-020, T-021, T-022, puis T-023.

- Chemin critique : T-001 → T-004 → T-005 → T-007 → T-011 → T-012 → T-014 → T-015 → T-016 → T-023.
- Possibles en parallèle (équipe de plusieurs personnes) : T-002, T-003 et T-004 après T-001 ; T-008, T-009 et T-010 après T-007 ; les tâches serveur d'un jalon (T-011, T-012, T-014, T-018) et les tâches d'interface précédentes.
- Les tâches d'interface (T-013, T-015, T-016, T-019) ne démarrent qu'une fois l'API correspondante fermée : l'interface s'appuie sur le contrat, pas sur une supposition.

## 4. Règles de conduite

- **Une tâche à la fois par personne ou par session d'IA** ; elle se termine par une pull request qui remplit `definition-of-done.md`.
- **Le contrat et le code avancent ensemble** : une tâche qui change une route change son schéma Zod, régénère `api/openapi.yaml` et `api/errors.*` dans le même commit (`pnpm api:check` en CI, ADR-0014). Une tâche qui change l'architecture met à jour l'ADR et `architecture.md` dans le même commit.
- **Chaque scénario Given/When/Then d'une story a un test** automatisé, ou une ligne de recette manuelle justifiée (`testing.md`, section 5).
- **Au-delà du MVP**, une tâche n'est écrite que quand sa fonctionnalité est cadrée (F-12 à F-14 en v1.1, F-15 à F-17 en v2, F-18 plus tard) ; les noms réservés sont dans `glossary.md`, section 3.

## 5. Risques de planning

| Risque | Effet | Parade |
| --- | --- | --- |
| Concurrence mal gérée sur la dernière place ou le dernier administrateur (RG-04, RG-07) | Limite dépassée, plus d'administrateur | Test de concurrence dans T-014 et T-018 dès l'écriture du service, pas en fin de projet |
| Écart entre le contrat écrit à la main et le contrat généré (T-005) | Interface et serveur divergent | T-005 se fait avant tout handler ; chaque écart est expliqué dans la pull request |
| Outil de migration réversible mal choisi (T-002) | Retour arrière impossible en production | ADR écrit à T-002, test appliquer-défaire-rejouer en CI (T-006) |
| Accessibilité traitée en fin de projet (T-021) | Reprise coûteuse de tous les écrans | axe lancé dès T-010 sur chaque écran, T-021 n'est que l'audit final |
| Tâches d'interface trop grosses pour une session | Dérive du planning | Découper T-010 (composants) si elle dépasse une session ; ne jamais mélanger deux jalons dans une pull request |
| Points ouverts de `security.md` (droits d'accès et d'export, copie hors serveur) | Mise en service sans décision | T-021 et T-022 les tranchent par écrit avant la recette |

## 6. Après le MVP (non planifié)

| Version | Fonctionnalités | Remarque |
| --- | --- | --- |
| v1.1 | F-12 inscription par un administrateur, F-13 historique, F-14 mon planning, F-20 mon profil ([T-025](https://github.com/nathanjouannon/Creno/issues/57)) | F-20 : ticket déjà écrit, il donne les droits d'accès et de rectification (`security.md`, section 6) ; les autres : écrire les tickets après la première utilisation réelle (`prd.md`, section 7) |
| v2 | F-15 notifications par e-mail, F-16 suivi des heures, F-17 export | F-15 exige un ADR et complète `api/events.md` |
| Plus tard | F-18 vue calendrier ; connexion Google, Facebook, Apple | ADR dédié pour l'authentification externe (ADR-0006) |
