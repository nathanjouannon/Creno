# Sécurité – Créno

Statut : version 1.0 (2026-10-26). Découle de `architecture.md`, des ADR 0006 (JWT), 0009 (Zod), 0012 (installation), 0013 (blocage), et des règles RG-01, RG-03, RG-04, RG-11, RG-12, RG-14, RG-17.

Données à protéger : nom, prénom et adresse e-mail des utilisateurs, mots de passe, jetons (connexion, invitation, réinitialisation), inscriptions. Aucune donnée bancaire, aucun téléphone : sensibilité modérée, donc un modèle de menaces léger plutôt qu'une analyse STRIDE complète.

## 1. Modèle de menaces

| Menace | Gravité | Parade |
| --- | --- | --- |
| Vol de compte par mot de passe faible ou force brute | Haute | Mot de passe de 10 caractères minimum, haché en argon2id (RG-01) ; blocage de 15 minutes après 5 échecs par adresse saisie, compte existant ou non (RG-03, ADR-0013) ; limite par adresse IP (section 4) |
| Un utilisateur exécute une action d'administration (élévation de droits) | Haute | Vérification du rôle côté serveur pour chaque requête, rôle lu en base et non dans le jeton (RG-14, RG-04, ADR-0006) ; un test d'accès par route d'administration |
| Un utilisateur modifie les données d'un autre (par exemple désinscrire autrui) | Haute | Chaque service compare l'utilisateur connecté au propriétaire de la ressource ; seul un administrateur agit sur les inscriptions d'autrui (RG-08) |
| Parcours des identifiants entiers (`/events/43`) | Moyenne | Droits vérifiés à chaque route ; événement passé « introuvable » pour un utilisateur (RG-09) ; aucune information sensible dans les URLs |
| Vol ou réutilisation d'un jeton JWT | Haute | Cookie `HttpOnly`, `Secure`, `SameSite=Lax`, jamais dans `localStorage` ; CSP contre l'XSS ; `tokenVersion` qui révoque toutes les sessions après réinitialisation (RG-12) ; durée de 30 jours acceptée, jeton vérifié en base à chaque requête |
| CSRF (requête forgée depuis un autre site) | Moyenne | `SameSite=Lax` et contrôle de l'en-tête `Origin` sur toute requête qui modifie des données |
| Injection SQL | Haute | Prisma, requêtes paramétrées uniquement ; jamais de SQL assemblé par concaténation |
| XSS via titre, description, lieu ou noms saisis | Haute | Échappement par React, `dangerouslySetInnerHTML` interdit, CSP stricte (section 4), validation Zod |
| Fuite de secret dans le dépôt | Haute | Secrets hors Git, scan automatique en intégration continue (section 2) |
| Lien de réinitialisation intercepté | Haute | Usage unique, valable 3 jours, jeton haché en base, un nouveau lien invalide les précédents (RG-12) ; transmis hors application par l'administrateur, canal à sa charge |
| Lien d'invitation diffusé trop largement | Moyenne | Valable jusqu'au début de l'événement seulement (RG-02) ; limite connue : il est réutilisable et non révocable, sauf en supprimant l'événement ; risque accepté |
| Révélation de l'existence d'un compte | Moyenne | Message de connexion unique « E-mail ou mot de passe incorrect » ; blocage identique que le compte existe ou non (ADR-0013) ; limite connue : le formulaire d'invitation indique qu'une adresse a déjà un compte (écran A3), réservé aux personnes détenant un lien d'invitation valide ; risque accepté |
| Prise de contrôle d'une instance non encore installée | Moyenne | Page d'installation introuvable dès qu'un utilisateur existe (RG-17) ; installer juste après le déploiement ; risque accepté (ADR-0012) |
| Blocage d'un tiers par saisies répétées de son adresse | Basse | Limite par adresse IP ; risque accepté |
| Fuite ou perte de sauvegarde | Moyenne | Sauvegardes chiffrées (section 2) ; copie hors serveur à envisager si le besoin apparaît |
| Fuite de données personnelles dans les journaux | Moyenne | Journaux sans mot de passe, jeton ni e-mail complet (section 4) |
| Dépendance vulnérable | Moyenne | Audit des dépendances et mises à jour automatiques en intégration continue |
| Suppression de compte incomplète (RGPD) | Haute | La ligne `User` est supprimée en entier (RG-11) ; test automatisé qui vérifie qu'aucune donnée nominative ne subsiste |

## 2. Secrets

- Aucun secret dans le code ni dans Git ; seul `.env.example` (noms des variables, sans valeurs) est versionné.
- Secrets de l'application : `AUTH_SECRET` (signature des JWT, 32 octets aléatoires au minimum), `DATABASE_URL` (identifiants de la base), `BACKUP_ENCRYPTION_KEY` (chiffrement des sauvegardes). La liste complète et le rôle de chaque variable sont dans `environments.md`.
- Local : fichier `.env` ignoré par Git. Serveur : fichier `.env` en lecture seule pour son propriétaire (droits 600), hors du dépôt.
- Rotation : `AUTH_SECRET` en cas de fuite ou une fois par an (tous les utilisateurs doivent alors se reconnecter) ; mot de passe de la base idem ; clé des sauvegardes en cas de fuite, avec nouveau chiffrement des sauvegardes à venir.
- Les sauvegardes sont chiffrées et conservées sur le serveur (décision du 2026-10-26). La clé de chiffrement doit être gardée aussi ailleurs que sur le serveur (gestionnaire de mots de passe du porteur du projet) : chiffrer avec une clé stockée à côté de la sauvegarde ne protège presque pas.
- Les jetons d'invitation et de réinitialisation sont stockés hachés ; les journaux ne les contiennent jamais.

## 3. Rôles et permissions

Trois situations : visiteur (non connecté), utilisateur (`USER`), administrateur (`ADMIN`). Un administrateur dispose aussi des actions d'un utilisateur.

| Action | Visiteur | Utilisateur | Administrateur |
| --- | --- | --- | --- |
| Installer l'instance (seulement tant qu'aucun utilisateur n'existe, RG-17) | oui | — | — |
| Se connecter ; ouvrir un lien de réinitialisation valide | oui | — | — |
| Créer un compte avec un lien d'invitation valide (RG-02) | oui | — | — |
| Voir les événements à venir, leurs créneaux et les inscrits | non | oui | oui |
| S'inscrire et se désinscrire soi-même d'un créneau (RG-08) | non | oui | oui |
| Supprimer son propre compte (sauf dernier administrateur, RG-04) | non | oui | oui |
| Voir les événements passés (lecture seule, RG-15) | non | non | oui |
| Créer, modifier, supprimer un événement ou un créneau | non | non | oui |
| Générer un lien d'invitation | non | non | oui |
| Retirer l'inscription d'un autre utilisateur (RG-08) | non | non | oui |
| Lister les membres, ouvrir une fiche | non | non | oui |
| Donner le droit administrateur à un autre membre | non | non | oui |
| Retirer son propre droit administrateur (s'il en reste un autre, RG-04) | non | non | oui |
| Retirer le droit administrateur d'un autre | non | non | non |
| Générer un lien de réinitialisation de mot de passe (RG-12) | non | non | oui |

## 4. Règles pour le code

**Authentification et sessions** (ADR-0006)
- Cookie `__Host-` suivi du nom de session, `HttpOnly`, `Secure`, `SameSite=Lax`, chemin `/`, durée 30 jours.
- Toute route sauf l'installation, la connexion, l'ouverture d'un lien d'invitation, l'ouverture d'un lien de réinitialisation et `/health` exige un utilisateur authentifié.
- Les permissions se vérifient côté serveur, dans les services, jamais seulement dans l'interface (RG-14).
- Mots de passe : argon2id, paramètres minimums recommandés par l'OWASP (mémoire 19 Mio, 2 itérations, 1 parallélisme), à fixer au squelette ; comparaison à temps constant.
- Une réponse de connexion ne dit jamais si l'e-mail existe ou si le mot de passe est faux, et son temps de réponse ne doit pas non plus le trahir (le mot de passe est haché même pour une adresse inconnue).

**Validation et données**
- Toute entrée externe (formulaire, paramètre de route, corps de requête) est validée par un schéma Zod avant tout traitement (ADR-0009).
- Prisma uniquement pour accéder à la base ; le SQL brut est interdit sauf requêtes paramétrées dans une migration revue.
- Aucune donnée saisie n'est insérée dans du HTML sans échappement ; `dangerouslySetInnerHTML` interdit.

**En-têtes HTTP** (posés par l'application ou le reverse proxy)
- `Strict-Transport-Security` (HSTS), `Content-Security-Policy` stricte (`default-src 'self'`, pas de script en ligne hors nonce), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `frame-ancestors 'none'`, `Permissions-Policy` sans capteurs.
- HTTPS obligatoire partout ; redirection du HTTP vers le HTTPS.

**Limites de débit** (réponse `429 RATE_LIMITED` avec `Retry-After`, `api/errors.md`)

| Cible | Limite par adresse IP |
| --- | --- |
| Connexion, réinitialisation de mot de passe, création de compte par invitation, installation | 10 requêtes par minute |
| Reste de l'API | 100 requêtes par minute |

À cela s'ajoute le blocage par adresse e-mail de 15 minutes après 5 échecs (RG-03). L'adresse IP est lue dans l'en-tête transmis par le reverse proxy, jamais depuis une valeur envoyée directement par un client.

**Journaux**
- Format JSON sur la sortie standard, avec un identifiant de requête et l'identifiant interne de l'utilisateur.
- Jamais de mot de passe, de jeton, ni d'e-mail en clair (affiché masqué, par exemple `a***@d***.fr`).
- Événements de sécurité journalisés : échec et blocage de connexion, génération et utilisation d'un lien de réinitialisation, changement de rôle, suppression de compte, installation.
- Pas de détail technique (trace, SQL) dans les réponses d'erreur, seulement dans les journaux.

**Données et RGPD**
- Données personnelles limitées au nom, prénom et e-mail (RG-01) ; hébergement dans l'Union européenne ; aucun cookie tiers, le cookie de session est strictement nécessaire.
- Effacement à la demande de l'utilisateur par la suppression du compte (RG-11).
- Purge régulière : lignes de `login_attempts` sans blocage depuis plus de 24 heures, jetons de réinitialisation expirés ou utilisés depuis plus de 30 jours.
- Mentions d'information (identité du responsable, finalité, durée, droits) à afficher à l'inscription et dans une page dédiée.

**Dépendances et intégration continue**
- Chaque pull request : audit des dépendances, scan de secrets, lint, tests (`environments.md`).
- Tests de sécurité automatisés : accès refusé à chaque route d'administration pour un utilisateur, aucune donnée nominative après suppression de compte, concurrence sur la dernière place (RG-07) et sur le dernier administrateur (RG-04).

## 5. Décisions de mise en œuvre (T-007)

- **Mots de passe** : argon2id (`@node-rs/argon2`), minimum OWASP : mémoire 19 456 Kio (19 Mio), 2 itérations, parallélisme 1, sel aléatoire par mot de passe. Les paramètres sont stockés dans chaque empreinte : les relever plus tard n'invalide pas les anciennes. La comparaison est faite par argon2 (temps constant).
- **Jeton** : JWT HS256 signé avec `AUTH_SECRET` (bibliothèque `jose`), contenant l'identifiant (`sub`), `tv` (`tokenVersion`), `iat` et `exp` (30 jours). Tout autre algorithme est refusé.
- **Exception de développement du cookie** : le préfixe `__Host-` exige `Secure`, que Safari refuse sur `http://localhost`. Hors production (`NODE_ENV` différent de `production`), le cookie s'appelle `session` et n'a pas l'attribut `Secure` ; en production il s'appelle `__Host-session` avec `Secure`.
- **Adresse IP** : lue dans `X-Forwarded-For` seulement si `TRUST_PROXY` vaut `true`, en prenant la dernière valeur (celle ajoutée par Caddy, qui écrase ce que le client envoie). Sinon aucun en-tête n'est cru et tous les appels partagent le même compteur (usage local).
- **Limites de débit** : fenêtre fixe d'une minute, compteurs en mémoire (une seule instance, `architecture.md`) ; `/setup`, `/auth/login`, `/password-resets/*` et `/invitations/*` partagent le budget de 10, le reste de l'API 100 ; `/health` n'est pas limité. Les compteurs sont perdus au redémarrage.
- **`Origin`** : toute requête `POST`, `PUT`, `PATCH` ou `DELETE` dont l'en-tête `Origin` est absent ou différent de `APP_URL` est refusée (`FORBIDDEN_ORIGIN`). Les clients qui ne sont pas des navigateurs doivent donc envoyer cet en-tête.
- **Blocage de connexion (T-009)** : la ligne de `login_attempts` est indexée par un HMAC-SHA256 de l'adresse normalisée (espaces retirés, minuscules), calculé avec `AUTH_SECRET` : la table ne permet pas de retrouver une adresse, même en essayant des adresses connues. Le cinquième échec consécutif bloque 15 minutes ; une tentative pendant le blocage ne le prolonge pas ; à la fin du blocage le compteur repart de zéro ; un succès supprime la ligne. La lecture, la décision et l'écriture du compteur forment une transaction sérialisable rejouée en cas de conflit : deux échecs simultanés sont tous comptés. Une adresse sans compte coûte le même temps qu'un mot de passe faux (vérification contre une empreinte factice). Les échecs et blocages sont journalisés avec l'identifiant interne de l'utilisateur quand il existe, jamais l'adresse saisie ni le mot de passe.
- **Retour à la page demandée** : l'adresse de la page de connexion accepte `?suite=<chemin>`. Seul un chemin de l'application est suivi (jamais un autre site, ni `/connexion`, `/installation`, `/api`).

## 6. Points à confirmer

- Durée de conservation des journaux (90 jours proposés).
- Droits d'accès, de rectification et d'export des données : le MVP ne couvre que l'effacement (RG-11) ; aucune page ne permet de corriger son nom ou son e-mail. À traiter avant la mise en service pour un club réel, ou à assumer explicitement.
- Copie des sauvegardes hors serveur : décision à revoir si le club accumule des données importantes.
