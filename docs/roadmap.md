# Feuille de route – Créno

Statut : version 2.1 (2026-10-29). Découle de `prd.md`, de `architecture/architecture.md` et de `api/openapi.yaml`. Les tâches sont des tickets GitHub (voir `tasks/README.md`) ; le contenu de chaque tâche est dans son issue.

Principe : un squelette qui tourne de bout en bout d'abord (M0), puis des tranches verticales : chaque jalon livre quelque chose d'utilisable, de la base de données à l'interface. Une tâche tient en une session de travail et cite les fichiers à lire.

## 1. MVP : développé, sauf les créneaux libres

Le MVP regroupe F-01 à F-11, F-19, F-20, F-21 et F-22 (`prd.md`, section 5). Tout est développé (tickets T-001 à T-025 fermés, scénario cible de bout en bout vert, `recette-mvp.md`) sauf F-22, les créneaux libres (T-026), qui **clôt le MVP**. F-20 « Mon profil » (T-025), prévue d'abord en v1.1, a été avancée au MVP.

| Jalon | Ce qui a été livré | Tâches | Fonctionnalités | État |
| --- | --- | --- | --- | --- |
| M0 – Squelette | Monorepo, base et migrations, tokens, socle API, contrat généré depuis Zod, image Docker, CI | T-001 à T-006 | — | Fait |
| M1 – Installation et accès | Installation de l'instance, connexion, rôles, composants de base | T-007 à T-010 | F-19, F-02, F-03 | Fait |
| M2 – Événements et créneaux | Événements et créneaux côté administrateur, description d'un créneau | T-011 à T-013, T-024 | F-04, F-05, F-21 | Fait |
| M3 – Inscriptions | Consulter, s'inscrire, se désinscrire ; suivi du remplissage et retrait d'un inscrit | T-014 à T-016 | F-06 à F-09 | Fait |
| M4 – Invitations et membres | Lien d'invitation, gestion des membres et des droits, réinitialisation du mot de passe | T-017 à T-019 | F-01, F-10 | Fait |
| M5 – Compte et mise en service | Suppression de compte, mentions et accessibilité, sauvegardes et exploitation, recette | T-020 à T-023, T-025 | F-11, F-20 | Fait, recette manuelle à faire |
| M6 – Créneaux libres | Mode d'inscription d'un événement (créneaux fixes, libres, ou les deux) ; le bénévole choisit ses horaires | [T-026](https://github.com/nathanjouannon/Creno/issues/65) | F-22 | À faire : documentation prête (ADR-0016), décisions à relire |

T-026 est une grosse tâche (modèle, services, API, deux interfaces) : son ticket demande de la découper une fois les décisions prises. Découpage proposé, un ticket par pull request :

1. Base et services : migration (mode, colonnes de `registrations`, contrainte, index) avec son retour arrière, schéma Prisma, services du mode (RG-19) et du créneau libre (RG-20), tests de concurrence ;
2. Contrat et routes : schémas Zod, registre de routes, codes d'erreur, `pnpm api:generate`, `pnpm api:check`, `pnpm api:lint` ;
3. Interface administrateur : `RegistrationModeField`, suivi et retrait des créneaux libres ;
4. Interface bénévole : `FreeSlotForm`, `FreeSlotList`, désinscription ; E2E des trois modes, accessibilité.

### Reste à faire avant la première version publiée

Ordre : T-026, puis la recette manuelle, puis la version. La mise en service est **conditionnelle** (`recette-mvp.md`, section 6) :

1. Développer F-22 (T-026) et ajouter ses scénarios à la recette automatisée (scénario E2E, matrice de `testing.md`) ;
2. Remplir la recette manuelle sur appareils réels (iPhone, Android, Chrome, Safari, Firefox, Edge).
3. Refaire les mesures de performance sur le serveur de production (les premières viennent d'une machine de développement).
4. Cocher la liste de `definition-of-done.md` dans la pull request.

Tout écart relevé devient un ticket.

## 2. Après le MVP

Les versions ci-dessous sont une **proposition d'ordre**, à valider par le propriétaire du produit. Une tâche n'est écrite que quand sa fonctionnalité est cadrée : les fonctionnalités F-12 à F-14 se cadrent après la première utilisation réelle (`prd.md`, section 7). Les noms réservés sont dans `glossary.md`, section 3.

### v1.1 – Confort d'usage

Objectif : corriger les frictions constatées après la première utilisation réelle, sans changer l'architecture. F-20 « Mon profil » (T-025) et les créneaux libres (F-22, T-026) sont au MVP, pas ici.

| Fonctionnalité | Contenu | Ticket | État |
| --- | --- | --- | --- |
| F-14 Mon planning | Liste de mes prochaines inscriptions sur un seul écran | à écrire | Cadrer |
| F-12 Inscription par un administrateur | Ajouter un bénévole à un créneau, même complet ou commencé, avec avertissement | à écrire | Cadrer |
| F-13 Historique des changements | Journal consultable par l'administrateur : qui a changé quoi, quand | à écrire | Cadrer (RG et RGPD : durée de conservation, données nominatives) |

Points d'attention :

- F-12 et F-13 doivent traiter les deux formes d'inscription introduites par F-22 (créneau fixe et créneau libre, ADR-0016) : F-12 pourra inscrire un bénévole sur un créneau libre pour autrui, F-14 listera aussi ses créneaux libres avec leurs propres horaires.
- F-13 touche tous les services d'écriture : la concevoir avant d'ajouter d'autres fonctionnalités qui écrivent, sinon l'historique sera rétrofité partout.
- Ordre conseillé : F-14 (petit, sans risque), F-12, puis F-13.

### v1.2 – Ouverture internationale et diffusion

Objectif : rendre Créno utilisable et trouvable hors du public francophone. La première version publiée (le MVP) précède la v1.2 : c'est la « première release versionnée » qu'exige le ticket #70.

| Sujet | Contenu | Ticket | Dépend de |
| --- | --- | --- | --- |
| Traduction anglaise | Documentation en anglais ; système de traduction de l'application, français et anglais complets | [#69](https://github.com/nathanjouannon/Creno/issues/69) | — |
| Diffusion | Licence, première release versionnée, page de démo, annuaires (`awesome-selfhosted`, AlternativeTo, OpenAlternative), annonces | [#70](https://github.com/nathanjouannon/Creno/issues/70) | #69 |

Points d'attention :

- #69 remet en cause « interface en français » (`AGENTS.md`, `conventions.md`, `glossary.md`) : décider d'abord la langue de référence de `docs/`, la bibliothèque d'internationalisation (ADR) et l'emplacement des textes d'erreur (l'interface se base sur `code`, jamais sur `message`).
- #70 exige une licence dans `LICENSE`, qui n'existe pas encore : décision du propriétaire, bloquante pour les annuaires.
- Les deux tickets ne touchent pas aux fonctionnalités : ils peuvent se faire en parallèle de la v1.1, à condition de traduire les textes ajoutés par la v1.1 dans la même pull request une fois #69 fusionné.

### v2 – Mobilisation et suivi

| Fonctionnalité | Contenu | Prérequis |
| --- | --- | --- |
| F-15 Notifications par e-mail | Confirmation, rappel avant le créneau, créneaux non pourvus | ADR (envoi, file, fournisseur ; budget 0 €), compléter `api/events.md`, décision RGPD sur l'envoi |
| F-17 Export des inscriptions | CSV et impression, identiques à l'écran de l'événement | Droits d'export et copie hors serveur (`security.md`) |
| F-16 Suivi des heures et classement | Total d'heures par bénévole, somme des créneaux validés | Définir « créneau validé » ; les plages libres de T-026 alimentent le calcul |

F-15 est prioritaire si les bénévoles ne répondent pas sans rappel (`prd.md`, risques).

### Plus tard

- F-18 : vue calendrier d'un événement côté administrateur.
- Connexion Google, Facebook, Apple : ADR dédié (ADR-0006).
- Autres langues que l'anglais, une fois le système de traduction en place.

## 3. Règles de conduite

- **Une tâche à la fois par personne ou par session d'IA** ; elle se termine par une pull request qui remplit `definition-of-done.md`.
- **Le contrat et le code avancent ensemble** : une tâche qui change une route change son schéma Zod, régénère `api/openapi.yaml` et `api/errors.*` dans le même commit (`pnpm api:check` en CI, ADR-0014). Une tâche qui change l'architecture met à jour l'ADR et `architecture.md` dans le même commit.
- **Chaque scénario Given/When/Then d'une story a un test** automatisé, ou une ligne de recette manuelle justifiée (`testing.md`, section 5).
- **Les documents d'abord** : un ticket qui change un comportement met à jour `prd.md`, `user-stories.md`, `business-rules.md` et `glossary.md` avant le code.
- **Ne jamais mélanger deux jalons ou deux versions** dans une pull request.

## 4. Risques

| Risque | Effet | Parade |
| --- | --- | --- |
| Recette manuelle jamais faite | Défaut d'affichage découvert par les bénévoles | La remplir avant d'annoncer l'instance à un club réel |
| T-026 modifie le modèle d'inscription (`registrations.slot_id` devient facultatif) | Régression sur la concurrence (RG-07) et la conservation des données (RG-11), recette manuelle retardée | ADR-0016 relu avant le code ; mode `FIXED` par défaut ; migration additive avec retour arrière ; tests de concurrence rejoués ; tâche découpée en quatre pull requests |
| F-13 ajoutée tard | Historique à rétrofiter dans chaque service, désormais pour deux formes d'inscription | La cadrer tôt en v1.1 |
| Traduction (#69) ajoutée après de nouveaux écrans | Textes en dur à extraire | Terminer #69 avant d'ajouter beaucoup d'écrans, ou écrire les nouveaux textes déjà dans les fichiers de langue |
| Annonce publique avant licence et démo | Projet non référencé, mauvaise première impression | Respecter les prérequis de #70 |
| Avancement bénévole irrégulier | Délai non maîtrisé | Versions courtes ; une fonctionnalité cadrée à la fois |
