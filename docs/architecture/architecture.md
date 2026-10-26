# Architecture – Créno

Statut : version 1.0 (2026-10-26). S'appuie sur `00-vision.md`, `prd.md`, `glossary.md`, `domain/` et `design/`. Chaque décision structurante est consignée dans un ADR (`adr/`, liste en section 7). La section 9 recense les documents à mettre à jour à la suite de ces décisions. Les schémas C4 sont `c4-context.mmd` (niveau 1), `c4-containers.mmd` (niveau 2) et `c4-components.mmd` (niveau 3, application web) ; `security.md` et `environments.md` suivent dans cette phase.

## 1. Contexte et contraintes

- Application web responsive (360 px minimum), français uniquement, une instance = une association (PRD section 6).
- Open source, développée bénévolement, budget logiciel 0 € ; hébergement cible : Docker sur un petit VPS ou un Raspberry (coût visé ≤ 5 €/mois, seule exception au 0 €).
- Volumétrie faible aujourd'hui (moins de 30 bénévoles), mais le nombre de fonctionnalités peut croître (versions 1.1 et 2 du PRD) : l'architecture doit rester évolutive sans devenir complexe dès le MVP.
- Aucun e-mail envoyé au MVP (RG-13) : pas de serveur SMTP, pas de lien magique.
- Après le MVP : connexion par fournisseurs externes (Google, puis Facebook et Apple). L'architecture d'authentification doit pouvoir les accueillir sans refonte (section 6.2).

## 2. Exigences non fonctionnelles

| Domaine | Exigence chiffrée | Source |
| --- | --- | --- |
| Volumétrie | Jusqu'à 200 comptes, 20 utilisateurs simultanés, 50 événements à venir | Décision du 2026-10-26 (petite association) |
| Temps de réponse | 95 % des requêtes serveur en moins de 1 s ; inscription à un créneau en moins de 500 ms | |
| Chargement | LCP inférieur à 2,5 s sur mobile en 4G | |
| Disponibilité | 99 % par mois (environ 7 h d'arrêt toléré), sans astreinte | |
| Sauvegarde | Sauvegarde quotidienne de la base, chiffrée et conservée sur le serveur, 7 jours + 1 par mois ; perte de données maximale 24 h, restauration en moins de 4 h | |
| Concurrence | Une place de créneau limité n'est jamais attribuée deux fois ; au moins un administrateur en permanence | RG-04, RG-07 |
| Sécurité | HTTPS partout, mots de passe hachés (argon2id), permissions vérifiées côté serveur, aucun secret dans Git ; blocage de 15 minutes après 5 échecs par adresse saisie, existante ou non, et limite par adresse IP (détails : `security.md`) | RG-01, RG-03, RG-14 |
| RGPD | Données limitées à nom, prénom, e-mail ; effacement à la suppression du compte ; hébergement dans l'Union européenne ; mentions d'information ; aucun cookie tiers (le cookie de session est strictement nécessaire, donc sans bandeau) | RG-11, PRD section 6 |
| Accessibilité | WCAG 2.2 niveau AA, vérifiée par tests automatisés (axe) et contrôle manuel avant la première mise en ligne | Décision du 2026-10-26 |
| Compatibilité | Deux dernières versions de Chrome, Safari, Firefox, Edge ; iOS et Android récents ; aucune installation | PRD section 6 |
| Dates | Un fuseau horaire par instance, dates stockées en UTC | RG-16 |
| Exploitation | Journaux JSON sur la sortie standard sans mot de passe, jeton ni e-mail complet ; point de santé `/health` ; alerte de disponibilité par un service externe gratuit | Décision du 2026-10-26 |
| Portabilité | Démarrage complet par `docker compose up` ; configuration par variables d'environnement | PRD section 6 |
| Mise à jour de l'interface | Rechargement simple, sans temps réel : l'écran se met à jour après chaque action et au rafraîchissement | Décision du 2026-10-26 |

## 3. Stack retenue

| Couche | Choix | Statut |
| --- | --- | --- |
| Langage et dépôt | TypeScript, monorepo | Décidé |
| Interface | Next.js (React), formulaires avec react-hook-form (`design/components.md`) | Décidé |
| Validation | Zod : un schéma par entrée (formulaire, requête d'API), partagé entre l'interface et le serveur | Décidé (2026-10-26) |
| Style | Tailwind CSS, thème généré depuis `design/tokens.json` | Décidé (2026-10-26) |
| Backend et accès aux données | Next.js (routes et services côté serveur) + Prisma | Décidé (2026-10-26, section 6.1) |
| Base de données | PostgreSQL (SGBD relationnel), schéma de `domain/schema.sql` repris dans `schema.prisma` | Décidé |
| Forme de l'API | Routes REST (Route Handlers Next.js) documentées par `api/openapi.yaml` | Décidé (2026-10-26, section 6.3) |
| Identifiants | Entiers auto-incrémentés | Décidé (voir `domain/erd.mmd`) |
| Authentification | Jeton JWT en cookie HttpOnly, vérifié en base à chaque requête ; fournisseurs externes après le MVP | Décidé (2026-10-26, section 6.2) |
| Installation | Page d'installation, utilisable une seule fois : crée le club et le premier administrateur | Décidé (2026-10-26, section 6.4) |
| Organisation du dépôt | Espace de travail pnpm : `apps/web` (Next.js), `packages/validation` (schémas Zod), `packages/tokens` (génération du style) | Proposé |
| Déploiement | Image Docker + `docker compose` (application + PostgreSQL), sur VPS ou Raspberry | Décidé |
| Intégration continue | GitHub Actions (lint, tests, scan de secrets, build) | Proposé, détaillé dans `environments.md` |

Principe : monolithe modulaire. Une seule application à déployer, découpée en modules métier pour pouvoir en extraire un plus tard si besoin.

### Validation : Zod
- Chaque entrée a un schéma Zod : création de compte, connexion, nouveau mot de passe, événement, créneau, et les paramètres de chaque route.
- Les schémas vivent dans un module commun importé par l'interface et par le serveur. L'interface les branche sur react-hook-form par un resolver (`design/components.md`, composant `Form`) ; le serveur les rejoue avant tout traitement. La validation côté client est un confort, le serveur reste la référence.
- Les types TypeScript se déduisent des schémas (`z.infer`), jamais écrits à la main en double.
- Les messages d'erreur ne sont pas écrits dans les schémas : ils viennent du catalogue `api/errors.md`.
- Un schéma ne porte que les règles d'une donnée prise isolément (format, longueur, fin après début : RG-01, RG-06, RG-07). Les règles qui dépendent de la base (e-mail déjà utilisé, limite sous le nombre d'inscrits, dernier administrateur) restent dans les services.

### Style : Tailwind CSS à partir de `tokens.json`
- `design/tokens.json` est la source de vérité unique des couleurs, typographies, espacements, rayons et tailles.
- Une étape de génération (Style Dictionary) transforme ce fichier en variables CSS et en thème Tailwind. Les classes utilitaires ne reposent que sur ces valeurs (par exemple `bg-primary`, `text-muted`, `rounded-button`), sans autre palette ni échelle.
- Le fichier généré ne se modifie jamais à la main ; changer une valeur = changer `tokens.json`, puis régénérer (étape intégrée à la compilation et à l'intégration continue).
- Règle pour l'IA et l'équipe, à reprendre dans `AGENTS.md` : aucune couleur, taille, espacement ni rayon en dur ; pas de valeurs arbitraires Tailwind (`bg-[#2563EB]`, `p-[13px]`), uniquement les classes issues des tokens. Une règle de lint la fait respecter.
- Les maquettes (`design/mockups/`) utilisent déjà les mêmes noms de variables (`--color-primary`, `--space-md`…), ce qui garde le passage du dessin au code direct.
- La version de Tailwind et la correspondance exacte entre catégories de tokens et thème Tailwind (notamment typographies et espacements) sont à fixer à l'implémentation du squelette (phase 8).

## 4. Découpage en composants

```
Interface (Next.js : pages, composants, formulaires)
        │  appelle
        ▼
Couche API (routes REST : authentification, validation Zod, erreurs de api/errors.md)
        │  appelle
        ▼
Services métier (règles RG-xx, permissions RG-14, transactions)
        │  appelle
        ▼
Accès aux données (dépôts : seule couche qui parle à la base)
        ▼
PostgreSQL
```

Règles de dépendance : le sens va toujours du haut vers le bas ; l'interface n'accède jamais à la base ; les règles de gestion et les permissions vivent dans les services, jamais dans l'interface ni dans les dépôts.

Modules métier (noms du glossaire) :

| Module | Responsabilité | Entités | Règles |
| --- | --- | --- | --- |
| `auth` | Connexion, déconnexion, JWT, blocage par adresse, mot de passe | `User` (connexion), `ResetToken`, `LoginAttempt` | RG-01, RG-03, RG-12 |
| `club` | Installation (club et premier administrateur), paramètres du club | `Club` | RG-04, RG-16 |
| `members` | Utilisateurs, rôles, suppression de compte | `User` | RG-04, RG-11, RG-14 |
| `invitations` | Liens d'invitation, création de compte | `Invitation` | RG-02 |
| `events` | Événements | `Event` | RG-06, RG-09, RG-10, RG-15 |
| `slots` | Créneaux et capacité | `Slot` | RG-07, RG-10 |
| `registrations` | Inscription, désinscription, retrait par un administrateur | `Registration` | RG-07, RG-08, RG-11 |
| `shared` | Configuration, erreurs, validation, horloge, fuseau | — | RG-16 |

États `upcoming`, `ongoing`, `past`, `started`, `full` : calculés dans les services à partir de l'heure courante, jamais stockés.

## 5. Contraintes pour le code

- Inscription à la dernière place et retrait du droit administrateur : transactions avec verrou ou contrainte, couverts par des tests de concurrence (RG-04, RG-07).
- Les ID sont énumérables : chaque route vérifie les droits côté serveur (RG-14).
- Les messages d'erreur viennent du catalogue `api/errors.md` ; le client se base sur le `code`.
- Toute entrée externe (formulaire, paramètre de route, corps de requête) est validée par un schéma Zod avant traitement.
- Aucune valeur de style en dur : uniquement les classes Tailwind issues des tokens.
- Les dates sont comparées en UTC et affichées dans le fuseau de l'instance (RG-16).

## 6. Décisions détaillées

### 6.1 Backend et données : Next.js + Prisma (décidé le 2026-10-26)

Comparaison qui a conduit au choix ; Convex est l'alternative écartée.

| Critère | Next.js + Prisma + PostgreSQL | Convex |
| --- | --- | --- |
| Modèle de données | Relationnel, directement celui de `domain/erd.mmd` et `schema.sql` | Documents ; le schéma et les contraintes (unicité, clés étrangères) s'écrivent dans le code |
| Identifiants | Entiers auto-incrémentés possibles | Identifiants propres à Convex, incompatibles avec le choix `INT` |
| Concurrence (RG-07, RG-04) | Transactions SQL et verrous bien connus | Transactions sérialisables intégrées |
| Temps réel | À construire (hors MVP) | Natif, utile si F-07 évolue vers l'instantané |
| Auto-hébergement à 0 € | `docker compose` standard, PostgreSQL partout | Version open source auto-hébergeable, maturité à vérifier ; sinon service hébergé hors UE possible |
| Contrat d'API (phase 7) | OpenAPI naturel avec des routes REST | Fonctions typées, pas d'OpenAPI naturel |
| Sauvegarde et RGPD | `pg_dump`, effacement par `DELETE` | Export propre à Convex |
| Évolutivité des fonctionnalités | Très bien connu, migrations de schéma à soigner | Moins de code de plomberie, dépendance plus forte à la plateforme |

Correspondance estimée : Next.js + Prisma environ 85 %, Convex environ 50 % (écart avec le modèle relationnel de `erd.mmd` et les identifiants `INT` déjà décidés). Retenu : **Next.js + Prisma + PostgreSQL**. Convex pourra être réévalué si le temps réel devient un besoin fort ; la couche de services isolée de l'accès aux données (section 4) limite le coût d'un tel changement.

Conséquences : `schema.sql` reste la référence lisible et `schema.prisma` (`@default(autoincrement())` pour les `INT`) en est la version exécutable, à écrire en phase 5 pour rester cohérents ; les migrations sont des scripts SQL versionnés avec un script de retour écrit à la main, l'outil exact étant fixé au squelette (`environments.md`, section 6) ; les contraintes que le schéma ne peut pas porter (RG-04, RG-07) restent dans les services avec transactions.

### 6.2 Authentification : JWT (décidé le 2026-10-26)

Critères tirés des règles de gestion : blocage après 5 échecs (RG-03), fermeture de toutes les sessions après réinitialisation (RG-12), création de compte par invitation (RG-02), suppression de compte (RG-11), changement de rôle immédiat (RG-04), aucun e-mail envoyé (RG-13), auto-hébergement sans service tiers.

Options étudiées (correspondance estimée à ces critères) :

| Option | Points forts | Points faibles | Correspondance |
| --- | --- | --- | --- |
| Session serveur en base + cookie HttpOnly | Révocation immédiate native (RG-12) ; aucune dépendance | Un stockage de sessions en plus | environ 90 % |
| JWT vérifié en base à chaque requête (retenu) | Format standard, compatible avec les fournisseurs externes à venir ; une seule lecture en base à cette échelle ; révocation possible | Un peu moins « sans état » qu'un JWT pur | environ 80 % |
| Better Auth | Moins de code de base | Invitation, blocage et réinitialisation par administrateur à surcharger | environ 70 % |
| Auth.js (NextAuth) | Répandu, intégré à Next.js | Fournisseur « identifiants » limité, pensé pour OAuth et e-mail | environ 40 % |
| JWT pur, sans lecture en base | Aucun accès à la base | **Ne permet pas RG-12, RG-11 ni RG-04** : un jeton volé ou d'un compte supprimé reste valable jusqu'à son expiration | environ 35 % |
| Service hébergé (Clerk…) | Mise en route rapide | Données chez un tiers, incompatible avec l'auto-hébergement à 0 € | environ 25 % |

**Décision** : jeton JWT signé, avec une adaptation indispensable. Un JWT pur ne peut pas être révoqué, or RG-12 (fermer les sessions), RG-11 (compte supprimé) et RG-04 (rôle modifié) exigent un effet immédiat. Le jeton est donc vérifié en base à chaque requête :
- Contenu : identifiant de l'utilisateur, version de jeton (`tokenVersion`), dates d'émission et d'expiration. Durée de validité : 30 jours (décidé le 2026-10-26).
- Transport : cookie `HttpOnly`, `Secure`, `SameSite=Lax`, jamais dans `localStorage`. Protection CSRF : `SameSite` et contrôle de l'en-tête `Origin` sur les requêtes qui modifient des données.
- À chaque requête : signature et expiration, puis lecture de l'utilisateur en base. Le jeton est refusé si l'utilisateur n'existe plus (RG-11) ou si `tokenVersion` ne correspond plus. Le rôle utilisé est celui lu en base, jamais celui du jeton (RG-04, RG-14).
- Réinitialisation de mot de passe réussie : `tokenVersion` augmente, toutes les sessions de l'utilisateur tombent (RG-12).
- Déconnexion : le cookie est effacé. Un jeton copié ailleurs resterait valable jusqu'à l'expiration ou jusqu'à une réinitialisation ; risque accepté, durée courte.
- Mots de passe : argon2id. Bibliothèque de jetons : `jose` (à confirmer).

**Après le MVP, Google, Facebook et Apple** (OAuth 2.0 / OpenID Connect) : l'utilisateur connecté par un fournisseur reçoit le même JWT applicatif, donc le reste du code ne change pas. Impacts à prévoir : `passwordHash` devient facultatif, nouvelle entité `ExternalIdentity` (fournisseur, identifiant chez le fournisseur, utilisateur) en prenant garde de ne pas réutiliser le mot « compte » du glossaire, e-mail confirmé par le fournisseur, et décision sur RG-02 (la connexion externe doit-elle rester soumise à une invitation pour rejoindre le club ?). Un ADR dédié sera écrit à ce moment.

### 6.3 Forme de l'API : routes REST (décidé le 2026-10-26)

- Les routes sont des Route Handlers Next.js sous `/api`, décrites par `api/openapi.yaml` (phase 7), référence unique pour l'interface, les tests et l'IA.
- Chaque route : authentification (6.2), validation Zod (section 3), appel d'un service, format d'erreur commun de `api/errors.md`.
- Les schémas Zod et le contrat OpenAPI doivent rester identiques (ADR-0014) : le contrat est écrit à la main d'abord (documentation d'abord), puis généré depuis Zod au squelette, commité dans `api/openapi.yaml` et vérifié en CI. Prisma ne produit pas l'OpenAPI : le schéma de base décrit les tables, le contrat décrit ce qui est exposé en HTTP.

### 6.4 Installation : création du club et du premier administrateur (décidé le 2026-10-26)

- Une page d'installation, au premier accès à l'instance, crée en une seule transaction le **club** (entité `Club`, une seule ligne : nom, fuseau horaire de l'instance (RG-16), autres informations à préciser) et le **premier administrateur** (RG-04).
- Elle n'est utilisable qu'une fois : tant qu'aucun utilisateur n'existe, elle est accessible ; ensuite elle répond « introuvable » définitivement. L'unicité est garantie par la base (transaction et contrainte), pas seulement par l'interface.
- Pas de code d'installation (décision du 2026-10-26) : la personne qui installe crée elle-même le club et l'administrateur, et installe juste après le déploiement. Point à revoir si le produit évolue.
- Conséquence : le choix du glossaire « le club n'est pas une entité » est remplacé (section 9).

### 6.5 Blocage de connexion par adresse (décidé le 2026-10-26)

- Le compteur d'échecs et le blocage de 15 minutes (RG-03) s'appliquent à l'adresse saisie, qu'elle corresponde à un compte ou non. La réponse est identique dans les deux cas (écran A7), ce qui ne révèle pas l'existence d'un compte.
- Les échecs sont conservés dans une table dédiée (`LoginAttempt`) indexée par l'empreinte de l'adresse (pas l'adresse en clair, pour ne pas stocker les adresses de tiers). `failedLoginCount` et `lockedUntil` quittent l'entité `User`.
- Une limite par adresse IP s'y ajoute (par exemple 10 requêtes par minute sur la connexion), au niveau de l'application ou du reverse proxy ; chiffres à fixer dans `security.md`.
- Inconvénient accepté : un tiers peut bloquer 15 minutes la connexion à une adresse connue en la saisissant 5 fois. Atténué par la limite par IP.

## 7. Décisions d'architecture à consigner (`adr/`)

| ADR | Sujet | État |
| --- | --- | --- |
| [0001](../adr/0001-monorepo-typescript-monolithe-modulaire.md) | Monorepo TypeScript, monolithe modulaire, Next.js | Acceptée |
| [0002](../adr/0002-postgresql-base-de-donnees.md) | PostgreSQL comme base de données | Acceptée |
| [0003](../adr/0003-identifiants-entiers.md) | Identifiants entiers auto-incrémentés | Acceptée |
| [0004](../adr/0004-deploiement-docker-vps.md) | Déploiement par Docker sur VPS ou Raspberry | Acceptée |
| [0005](../adr/0005-nextjs-prisma-backend.md) | Next.js + Prisma comme backend et accès aux données (Convex écarté) | Acceptée |
| [0006](../adr/0006-authentification-jwt-verifie-en-base.md) | Authentification par JWT vérifié en base, fournisseurs externes après le MVP | Acceptée |
| [0007](../adr/0007-accessibilite-wcag-22-aa.md) | Accessibilité : WCAG 2.2 niveau AA | Acceptée |
| [0008](../adr/0008-pas-de-temps-reel-au-mvp.md) | Pas de temps réel au MVP | Acceptée |
| [0009](../adr/0009-zod-validation-partagee.md) | Zod pour la validation, schémas partagés interface et serveur | Acceptée |
| [0010](../adr/0010-tailwind-depuis-tokens.md) | Tailwind CSS généré depuis `tokens.json` (Style Dictionary) | Acceptée |
| [0011](../adr/0011-api-rest-openapi.md) | API en routes REST décrites par OpenAPI | Acceptée |
| [0012](../adr/0012-page-installation-et-club.md) | Page d'installation et entité `Club` | Acceptée |
| [0013](../adr/0013-blocage-connexion-par-adresse.md) | Blocage de connexion par adresse saisie | Acceptée |
| [0014](../adr/0014-contrat-api-genere-depuis-zod.md) | Contrat d'API écrit d'abord, puis généré depuis Zod | Acceptée |

## 8. Points à confirmer

- Informations du club saisies à l'installation (nom et fuseau horaire sont retenus ; autres champs éventuels).
- Bibliothèque `jose` pour les jetons.
- Organisation du monorepo proposée en section 3 (`apps/web`, `packages/validation`, `packages/tokens`).
- Version de Tailwind et correspondance tokens → thème, à fixer au squelette (phase 8).

## 9. Documents à mettre à jour à la suite de ces décisions

| Document | Changement |
| --- | --- |
| `domain/erd.mmd`, `schema.sql`, futur `schema.prisma` | Ajouter `Club` (nom, fuseau, date de création). Ajouter `User.tokenVersion`. Retirer `failedLoginCount` et `lockedUntil` de `User` et ajouter `LoginAttempt` (empreinte de l'adresse, nombre d'échecs, fin de blocage, date de mise à jour). |
| `glossary.md` | `Club` devient une entité (annule « club implicite »). Ajouter `LoginAttempt`, `tokenVersion`. Réserver `ExternalIdentity`. « Blocage de connexion » s'applique à une adresse. |
| `domain/business-rules.md` | RG-03 : blocage par adresse, compte existant ou non. RG-04 : premier administrateur créé par la page d'installation. RG-16 : le fuseau est celui du club (`Club`). Nouvelle règle sur l'installation (une seule fois). |
| `flows/`, `design/wireframes/` | Nouveau flux et nouvel écran « Installation » ; écran A7 inchangé visuellement. |
| `prd.md`, `user-stories.md` | Nouvelle fonctionnalité d'installation (Must) avec ses scénarios. |
