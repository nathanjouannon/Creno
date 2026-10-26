# Événements et messages – Créno

Statut : version 1.0 (2026-10-26).

## 1. Au MVP : aucun événement asynchrone

Le MVP n'a ni file de messages, ni WebSocket, ni SSE, ni webhook, ni tâche déclenchée par un événement.

- Pas de temps réel : l'interface se met à jour après chaque action de l'utilisateur et au rafraîchissement (ADR-0008). La concurrence est traitée côté serveur par des transactions (RG-04, RG-07), pas par des messages.
- Pas de notification : l'application n'envoie aucun e-mail (RG-13, F-15 reporté).
- Pas de service externe qui appelle l'API : le contrat d'interface complet est `openapi.yaml` (appels synchrones HTTP).
- Les modules internes (`auth`, `events`, `slots`…) s'appellent par des fonctions, sans bus d'événements (`architecture/architecture.md`, section 4).

Une personne ou une IA qui a besoin d'un événement, d'une file ou d'un webhook ne doit pas l'inventer : elle écrit d'abord un ADR, puis complète ce fichier.

## 2. Événements prévus après le MVP (à cadrer, non spécifiés)

Ces noms sont réservés pour que les futurs ajouts restent cohérents. Les champs, canaux et garanties se décident au moment de la fonctionnalité concernée.

| Fonctionnalité | Événement réservé | Émis par | Réagit | À décider |
| --- | --- | --- | --- | --- |
| F-13 Historique des changements (v1.1) | `AuditLog` écrit à chaque création, modification, inscription et désinscription | Services `events`, `slots`, `registrations` | Journal consultable par un administrateur | Écriture dans la même transaction que le changement (recommandé : aucun événement perdu) ou via un bus interne |
| F-15 Notifications par e-mail (v2) | Rappel avant un créneau ; confirmation d'inscription ; créneau non pourvu | Services `registrations` et un traitement planifié | Envoi d'e-mail | Fournisseur d'envoi, file avec nouvelles tentatives, déduplication (« sans doublon », PRD), désabonnement, nouvelles variables d'environnement |
| F-12 Inscription par un administrateur (v1.1) | Aucun événement : simple route HTTP | | | Voir `glossary.md`, section 3 |

## 3. Gabarit pour un futur événement

À remplir pour chaque événement ajouté (inspiré d'AsyncAPI ; un fichier `asyncapi.yaml` remplace ce fichier si le nombre d'événements devient important) :

- **Nom** : `domaine.action` au passé (`registration.created`), version du format (`v1`).
- **Émis quand, par qui** : service émetteur et règle de gestion (RG-xx).
- **Contenu (payload)** : champs, types, exemple JSON ; jamais de mot de passe, de jeton ni d'e-mail en clair (`architecture/security.md`).
- **Canal** : nom de la file ou du sujet.
- **Destinataires** : qui réagit et que fait-il.
- **Garanties** : ordre, livraison au moins une fois (donc doublons possibles : le destinataire doit être idempotent), nombre de tentatives, file des échecs.
