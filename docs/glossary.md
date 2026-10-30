# Glossaire – Créno

Statut : brouillon v0.2 (2026-10-29). Un terme = une définition = un nom dans le code. Source : `prd.md`, `domain/business-rules.md`, `flows/`, `design/`.

Règles d'usage :
- Le code, la base de données, l'API et les composants utilisent les noms de la colonne « Code » (anglais). L'interface, les messages et les documents utilisent les termes français.
- Un mot de la colonne « À ne pas employer » ne désigne jamais ce concept, ni dans le code ni dans un nouveau document.
- Les mots d'interface (section 2) sont des libellés affichés ; ils ne créent pas de concept.
- La casse (camelCase, snake_case) est fixée en phase 6 dans `docs/conventions.md`.

## 1. Termes du domaine

### Personnes et comptes

| Terme (FR) | Code | Définition | Règles | À ne pas employer |
| --- | --- | --- | --- | --- |
| Utilisateur | `User` | Une personne ayant un compte Créno. Il n'existe pas de concept « compte » distinct : créer ou supprimer un compte = créer ou supprimer un `User`. Attributs : nom (`lastName`) et prénom (`firstName`), 50 caractères au plus chacun, e-mail unique (`email`, 254 caractères au plus), mot de passe (10 à 128 caractères, stocké haché, `passwordHash`), rôle. | RG-01, RG-11 | `Account`, `Member`, `Volunteer` comme noms de classe ou de table |
| Rôle | `Role` | Droit attaché à un utilisateur : `USER` ou `ADMIN`. Un seul rôle par utilisateur. | RG-04 | « profil », « type d'utilisateur », « permission » |
| Administrateur | `ADMIN` (valeur de `Role`) | Utilisateur qui gère les événements, créneaux, invitations et utilisateurs. Il y en a toujours au moins un ; seul l'intéressé peut retirer son propre droit. | RG-04 | `Admin` comme entité à part, « super-utilisateur » |
| Utilisateur (rôle simple) | `USER` (valeur de `Role`) | Utilisateur sans droit d'administration : consulte les événements, s'inscrit et se désinscrit. | | « bénévole » comme valeur de rôle |
| Connexion | `login` | Ouverture de session par e-mail et mot de passe. | RG-03 | « authentification » dans l'interface |
| Échec de connexion | `LoginAttempt.failedCount` | Compteur d'échecs consécutifs pour une adresse saisie, qu'elle ait un compte ou non ; remis à zéro après une connexion réussie. | RG-03 | `failedLoginCount` sur `User` (abandonné) |
| Blocage de connexion | `LoginAttempt.lockedUntil` | Date jusqu'à laquelle la connexion avec cette adresse est refusée (15 minutes après le 5e échec). Vide si l'adresse n'est pas bloquée. La réponse est la même pour une adresse sans compte. | RG-03 | « verrouillage », « désactivation » (concept abandonné), `lockedUntil` sur `User` |
| Version de jeton | `User.tokenVersion` | Nombre incrémenté à la réinitialisation du mot de passe ; un jeton de connexion émis avec une autre version est refusé. | RG-12 | « numéro de session » |
| Mon profil | `me` (module, route `/me`) | Page où l'utilisateur consulte et modifie son nom, son prénom et son e-mail. Le mot « profil » ne désigne que cette page, jamais un rôle ; le code dit `me`, pas `Profile`. | RG-18 | `Profile`, `Account` |
| Suppression de compte | `deleteUser` | Effacement du nom, du prénom et de l'e-mail d'un utilisateur, libération de ses inscriptions futures, anonymisation des passées. Seul le titulaire la déclenche. | RG-11, RG-04 | « désactivation », « archivage » |

### Invitations et réinitialisation

| Terme (FR) | Code | Définition | Règles | À ne pas employer |
| --- | --- | --- | --- | --- |
| Invitation | `Invitation` | Lien réutilisable, créé par un administrateur depuis un événement, qui permet à plusieurs personnes de créer leur compte. Attributs : jeton (`token`), événement (`eventId`), la validité n'est pas stockée : le lien est valable jusqu'au début actuel de l'événement. | RG-02 | « parrainage », « code d'accès » |
| Jeton de réinitialisation | `ResetToken` | Jeton à usage unique, créé par un administrateur pour un utilisateur, qui permet à celui-ci de choisir un nouveau mot de passe. Attributs : jeton (`token`), utilisateur (`userId`), fin de validité (`expiresAt`, 3 jours), date d'utilisation (`usedAt`). Le lien de réinitialisation est l'URL qui contient ce jeton. | RG-12 | `PasswordReset` (nom de fonctionnalité, pas de donnée), « mot de passe temporaire » |

### Événements, créneaux, inscriptions

| Terme (FR) | Code | Définition | Règles | À ne pas employer |
| --- | --- | --- | --- | --- |
| Événement | `Event` | Occasion organisée par le club (compétition, journée de ski…). Attributs : titre (`title`, 100 caractères au plus), description (texte brut de 2 000 caractères au plus), lieu (`location`, 200 caractères au plus), début (`startsAt`), fin (`endsAt`, après le début). Mode d'inscription (`registrationMode`). Peut exister sans créneau. | RG-06, RG-09, RG-10, RG-19 | « activité », « sortie » |
| Créneau (fixe) | `Slot` | Plage horaire définie par l'administrateur pendant laquelle des bénévoles sont attendus. On dit « créneau fixe » seulement pour le distinguer d'un créneau libre ; « créneau » seul désigne toujours un `Slot`. Appartient à un seul événement ; attributs : début (`startsAt`), fin (`endsAt`), capacité (`capacity`), description facultative (`description`, texte brut de 500 caractères au plus). | RG-07, RG-08, RG-10 | `Shift`, « tranche », « session », « poste » ; `Slot` pour un créneau libre |
| Mode d'inscription | `registrationMode` (`FIXED`, `FREE`, `BOTH`) | Réglage d'un événement : créneaux fixes seulement (défaut), créneaux libres seulement, ou les deux. En `BOTH`, les créneaux fixes sont proposés à titre indicatif. Changer de mode est refusé tant que l'événement contient un type de créneau que le nouveau mode n'accepte pas. | RG-19 | `type`, `mode` seul, « formule » |
| Créneau libre | `freeSlot` | Plage choisie par le bénévole lui-même (heure de début et de fin) dans les dates d'un événement, 30 minutes au moins. C'est une `Registration` sans créneau fixe : `slotId` vide, rattachée à l'événement (`eventId`) avec ses propres `startsAt` et `endsAt`. Sans limite de places, jamais « complet ». Un utilisateur peut en avoir plusieurs par événement, sans recouvrement. | RG-19, RG-20 | `Slot` (réservé aux créneaux fixes), `customSlot`, `range`, `freeRange`, « plage libre » |
| Capacité | `capacity` | Nombre maximal d'inscriptions d'un créneau fixe. Vide (`null`) = places illimitées. Ne peut pas être abaissée sous le nombre d'inscrits. | RG-07 | « quota », « maxAttendees », « limite » dans le code (« limite de places » reste correct à l'écran) |
| Places restantes | `remainingPlaces` | Valeur calculée : `capacity` moins le nombre d'inscriptions. N'existe que pour un créneau limité. Jamais stockée. | RG-07 | |
| Complet | `full` | État calculé : créneau limité dont le nombre d'inscriptions a atteint `capacity`. Un créneau illimité n'est jamais complet. | RG-07 | « fermé », « saturé » |
| Inscription | `Registration` | Lien entre un utilisateur et un créneau fixe (`userId`, `slotId`), unique par couple ; ou, pour un créneau libre, entre un utilisateur et un événement avec ses propres horaires (`userId`, `eventId`, `startsAt`, `endsAt`, `slotId` vide). Supprimée à la désinscription. Après suppression du compte, l'inscription passée est conservée avec `userId` vide. | RG-07, RG-08, RG-11, RG-20 | `Signup`, `Booking`, « réservation », « participation » ; « inscription » ne désigne jamais la création d'un compte |
| Inscrit | `attendee` | Utilisateur qui a une inscription sur un créneau (rôle d'affichage, pas une entité). Affiché « Prénom N. ». | RG-09 | « participant », « volontaire » |
| S'inscrire | `register` | Créer une inscription sur un créneau (jusqu'à son début, avec une place disponible). | RG-07, RG-08 | « réserver », « rejoindre » |
| Se désinscrire | `unregister` | Supprimer sa propre inscription (jusqu'au début du créneau, avec confirmation). | RG-08 | « annuler » (réservé à la suppression d'un événement ou créneau) |
| Ancien membre | `registration.userId = null` | Libellé affiché pour une inscription passée dont le titulaire a supprimé son compte. | RG-11 | « utilisateur supprimé », « anonyme » |
| Remplissage | `fill` | Suivi par l'administrateur du nombre d'inscrits de chaque créneau (« 3 / 4 », « 5 inscrits »). Vue = page de l'événement côté administrateur. | RG-07 | « taux de remplissage » comme champ stocké |
| Créneau vide | `empty` | État calculé d'un créneau limité sans aucune inscription ; mis en évidence côté administrateur (« Aucun inscrit »). | | « créneau non pourvu » (réservé à F-15) |

### Club et installation

| Terme (FR) | Code | Définition | Règles | À ne pas employer |
| --- | --- | --- | --- | --- |
| Club | `Club` | L'association propriétaire de l'instance. Une seule ligne par instance, créée à l'installation. Attributs : nom (`name`, 120 caractères au plus), fuseau horaire (`timezone`). | RG-16, RG-17 | « organisation », « tenant », « association » comme nom de table |
| Installation | `setup` | Première configuration d'une instance : une page, utilisable une seule fois, crée le club et le premier administrateur. | RG-04, RG-17 | « configuration initiale », « onboarding » |

### États dans le temps (calculés, jamais stockés)

| Terme (FR) | Code | Définition | Règles |
| --- | --- | --- | --- |
| Événement à venir | `upcoming` | `now` < `startsAt`. | RG-02, RG-09 |
| Événement en cours | `ongoing` | `startsAt` ≤ `now` < `endsAt`. Toujours visible des utilisateurs ; plus d'invitation possible. | RG-02, RG-09 |
| Événement passé | `past` | `endsAt` ≤ `now`. Masqué des utilisateurs, visible des administrateurs en lecture seule (onglet « Passés »). | RG-09 |
| Créneau commencé | `started` | `startsAt` du créneau (fixe ou libre) ≤ `now` : plus d'inscription ni de désinscription par l'utilisateur. | RG-08, RG-20 |

## 2. Mots d'interface

Ces mots s'affichent mais ne sont pas des concepts du modèle.

| Mot affiché | Désigne | Où |
| --- | --- | --- |
| Membre | Un `User` | Onglet « Membres », fiche membre, « ancien membre » |
| Bénévole | Un `User` considéré dans son rôle de volontaire, ou l'ensemble des utilisateurs | « Inviter des bénévoles », persona du PRD |
| Club | L'association propriétaire de l'instance, représentée par l'entité `Club` (voir section 1) | « Rejoindre le club » |
| Passés | Les événements passés (administrateur) | Onglet de navigation |
| Créneaux proposés | Les créneaux fixes d'un événement en mode `BOTH` (indicatifs, toujours inscriptibles) | Titre de groupe sur la page de l'événement |
| Mes horaires | Le créneau libre de l'utilisateur connecté | Bouton « Choisir mes horaires », étiquette « toi » |
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
| Connexion externe (Google, Facebook, Apple) | `ExternalIdentity` (fournisseur, identifiant chez le fournisseur, utilisateur) | Après le MVP (`architecture/architecture.md` 6.2) ; ne pas nommer « Account » |

## 4. Points à confirmer

- Un second clic sur « Inviter des bénévoles » réaffiche-t-il l'invitation existante de l'événement ou en crée-t-il une nouvelle ? (une `Invitation` par événement à trancher avec le schéma).
- Anonymisation : la colonne `userId` doit accepter `null` ; à reporter dans `domain/schema.sql`.
- Alignement à faire : `business-rules.md`, `user-stories.md` et `prd.md` emploient « membre », « utilisateur » et « bénévole » de façon mêlée ; relire à la lumière de la section 2.
