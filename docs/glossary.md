# Glossaire – Créno

Statut : brouillon v0.1 (2026-10-25). Un terme = une définition = un nom dans le code. Source : `prd.md`, `domain/business-rules.md`, `flows/`, `design/`.

Règles d'usage :
- Le code, la base de données, l'API et les composants utilisent les noms de la colonne « Code » (anglais). L'interface, les messages et les documents utilisent les termes français.
- Un mot de la colonne « À ne pas employer » ne désigne jamais ce concept, ni dans le code ni dans un nouveau document.
- Les mots d'interface (section 2) sont des libellés affichés ; ils ne créent pas de concept.
- La casse (camelCase, snake_case) est fixée en phase 6 dans `docs/conventions.md`.

## 1. Termes du domaine

### Personnes et comptes

| Terme (FR) | Code | Définition | Règles | À ne pas employer |
| --- | --- | --- | --- | --- |
| Utilisateur | `User` | Une personne ayant un compte Créno. Il n'existe pas de concept « compte » distinct : créer ou supprimer un compte = créer ou supprimer un `User`. Attributs : nom (`lastName`), prénom (`firstName`), e-mail unique (`email`), mot de passe (stocké haché, `passwordHash`), rôle. | RG-01, RG-11 | `Account`, `Member`, `Volunteer` comme noms de classe ou de table |
| Rôle | `Role` | Droit attaché à un utilisateur : `USER` ou `ADMIN`. Un seul rôle par utilisateur. | RG-04 | « profil », « type d'utilisateur », « permission » |
| Administrateur | `ADMIN` (valeur de `Role`) | Utilisateur qui gère les événements, créneaux, invitations et utilisateurs. Il y en a toujours au moins un ; seul l'intéressé peut retirer son propre droit. | RG-04 | `Admin` comme entité à part, « super-utilisateur » |
| Utilisateur (rôle simple) | `USER` (valeur de `Role`) | Utilisateur sans droit d'administration : consulte les événements, s'inscrit et se désinscrit. | | « bénévole » comme valeur de rôle |
| Connexion | `login` | Ouverture de session par e-mail et mot de passe. | RG-03 | « authentification » dans l'interface |
| Échec de connexion | `failedLoginCount` | Compteur d'échecs consécutifs d'un utilisateur ; remis à zéro après une connexion réussie. | RG-03 | |
| Blocage de connexion | `lockedUntil` | Date jusqu'à laquelle un compte ne peut pas se connecter (15 minutes après le 5e échec). Vide si le compte n'est pas bloqué. | RG-03 | « verrouillage », « désactivation » (concept abandonné) |
| Suppression de compte | `deleteUser` | Effacement du nom, du prénom et de l'e-mail d'un utilisateur, libération de ses inscriptions futures, anonymisation des passées. Seul le titulaire la déclenche. | RG-11, RG-04 | « désactivation », « archivage » |

### Invitations et réinitialisation

| Terme (FR) | Code | Définition | Règles | À ne pas employer |
| --- | --- | --- | --- | --- |
| Invitation | `Invitation` | Lien réutilisable, créé par un administrateur depuis un événement, qui permet à plusieurs personnes de créer leur compte. Attributs : jeton (`token`), événement (`eventId`), la validité n'est pas stockée : le lien est valable jusqu'au début actuel de l'événement. | RG-02 | « parrainage », « code d'accès » |
| Jeton de réinitialisation | `ResetToken` | Jeton à usage unique, créé par un administrateur pour un utilisateur, qui permet à celui-ci de choisir un nouveau mot de passe. Attributs : jeton (`token`), utilisateur (`userId`), fin de validité (`expiresAt`, 3 jours), date d'utilisation (`usedAt`). Le lien de réinitialisation est l'URL qui contient ce jeton. | RG-12 | `PasswordReset` (nom de fonctionnalité, pas de donnée), « mot de passe temporaire » |

### Événements, créneaux, inscriptions

| Terme (FR) | Code | Définition | Règles | À ne pas employer |
| --- | --- | --- | --- | --- |
| Événement | `Event` | Occasion organisée par le club (compétition, journée de ski…). Attributs : titre (`title`), description, lieu (`location`), début (`startsAt`), fin (`endsAt`, après le début). Peut exister sans créneau. | RG-06, RG-09, RG-10 | « activité », « sortie » |
| Créneau | `Slot` | Plage horaire d'un événement pendant laquelle des bénévoles sont attendus. Appartient à un seul événement ; attributs : début (`startsAt`), fin (`endsAt`), capacité (`capacity`). | RG-07, RG-08, RG-10 | `Shift`, « tranche », « session », « poste » |
| Capacité | `capacity` | Nombre maximal d'inscriptions d'un créneau. Vide (`null`) = places illimitées. Ne peut pas être abaissée sous le nombre d'inscrits. | RG-07 | « quota », « maxAttendees », « limite » dans le code (« limite de places » reste correct à l'écran) |
| Places restantes | `remainingPlaces` | Valeur calculée : `capacity` moins le nombre d'inscriptions. N'existe que pour un créneau limité. Jamais stockée. | RG-07 | |
| Complet | `full` | État calculé : créneau limité dont le nombre d'inscriptions a atteint `capacity`. Un créneau illimité n'est jamais complet. | RG-07 | « fermé », « saturé » |
| Inscription | `Registration` | Lien entre un utilisateur et un créneau (`userId`, `slotId`). Unique par couple. Supprimée à la désinscription. Après suppression du compte, l'inscription passée est conservée avec `userId` vide. | RG-07, RG-08, RG-11 | `Signup`, `Booking`, « réservation », « participation » ; « inscription » ne désigne jamais la création d'un compte |
| Inscrit | `attendee` | Utilisateur qui a une inscription sur un créneau (rôle d'affichage, pas une entité). Affiché « Prénom N. ». | RG-09 | « participant », « volontaire » |
| S'inscrire | `register` | Créer une inscription sur un créneau (jusqu'à son début, avec une place disponible). | RG-07, RG-08 | « réserver », « rejoindre » |
| Se désinscrire | `unregister` | Supprimer sa propre inscription (jusqu'au début du créneau, avec confirmation). | RG-08 | « annuler » (réservé à la suppression d'un événement ou créneau) |
| Ancien membre | `registration.userId = null` | Libellé affiché pour une inscription passée dont le titulaire a supprimé son compte. | RG-11 | « utilisateur supprimé », « anonyme » |
| Remplissage | `fill` | Suivi par l'administrateur du nombre d'inscrits de chaque créneau (« 3 / 4 », « 5 inscrits »). Vue = page de l'événement côté administrateur. | RG-07 | « taux de remplissage » comme champ stocké |
| Créneau vide | `empty` | État calculé d'un créneau limité sans aucune inscription ; mis en évidence côté administrateur (« Aucun inscrit »). | | « créneau non pourvu » (réservé à F-15) |

### États dans le temps (calculés, jamais stockés)

| Terme (FR) | Code | Définition | Règles |
| --- | --- | --- | --- |
| Événement à venir | `upcoming` | `now` < `startsAt`. | RG-02, RG-09 |
| Événement en cours | `ongoing` | `startsAt` ≤ `now` < `endsAt`. Toujours visible des utilisateurs ; plus d'invitation possible. | RG-02, RG-09 |
| Événement passé | `past` | `endsAt` ≤ `now`. Masqué des utilisateurs, visible des administrateurs en lecture seule (onglet « Passés »). | RG-09 |
| Créneau commencé | `started` | `startsAt` du créneau ≤ `now` : plus d'inscription ni de désinscription par l'utilisateur. | RG-08 |

## 2. Mots d'interface

Ces mots s'affichent mais ne sont pas des concepts du modèle.

| Mot affiché | Désigne | Où |
| --- | --- | --- |
| Membre | Un `User` | Onglet « Membres », fiche membre, « ancien membre » |
| Bénévole | Un `User` considéré dans son rôle de volontaire, ou l'ensemble des utilisateurs | « Inviter des bénévoles », persona du PRD |
| Club | L'association propriétaire de l'instance. Aucune entité `Club` : le nom est une configuration (voir `architecture/environments.md`, phase 6) | « Rejoindre le club » |
| Passés | Les événements passés (administrateur) | Onglet de navigation |
| Créer mon compte | Création d'un `User` depuis une `Invitation` | Formulaire d'invitation |

## 3. Termes réservés (versions futures)

Noms décidés d'avance pour que les futurs ajouts restent cohérents ; aucun n'est à coder au MVP.

| Terme (FR) | Code proposé | Fonctionnalité |
| --- | --- | --- |
| Journal des modifications | `AuditLog` | F-13 (v1.1) |
| Inscription par l'administrateur | `Registration` créée avec `registeredBy` | F-12 (v1.1) : peut dépasser `capacity`, avec avertissement |
| Mon planning | vue sur les `Registration` à venir de l'utilisateur | F-14 (v1.1) |
| Notification | `Notification` | F-15 (v2) |
| Heures de bénévolat | calculées depuis les `Slot` validés | F-16 (v2) |
| Export | `export` | F-17 (v2) |
| Liste d'attente | à décider | Question ouverte du PRD |

## 4. Points à confirmer

- Un second clic sur « Inviter des bénévoles » réaffiche-t-il l'invitation existante de l'événement ou en crée-t-il une nouvelle ? (une `Invitation` par événement à trancher avec le schéma).
- Anonymisation : la colonne `userId` doit accepter `null` ; à reporter dans `domain/schema.sql`.
- Alignement à faire : `business-rules.md`, `user-stories.md` et `prd.md` emploient « membre », « utilisateur » et « bénévole » de façon mêlée ; relire à la lumière de la section 2.
