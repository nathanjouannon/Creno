# ADR-0006 : Authentification par JWT vérifié en base

Statut : acceptée (2026-10-26)

## Contexte
Règles à respecter : blocage après 5 échecs (RG-03), fermeture de toutes les sessions après réinitialisation (RG-12), création de compte par invitation (RG-02), suppression de compte (RG-11), changement de rôle immédiat (RG-04), aucun e-mail envoyé (RG-13), auto-hébergement sans service tiers. Le porteur du projet souhaite des jetons JWT au MVP, puis la connexion par Google, Facebook et Apple.

## Décision
Jeton JWT signé, avec une adaptation : il est vérifié en base à chaque requête.
- Contenu : identifiant de l'utilisateur, version de jeton (`User.tokenVersion`), dates d'émission et d'expiration (30 jours, usage occasionnel sur smartphone).
- Transport : cookie `HttpOnly`, `Secure`, `SameSite=Lax`, jamais dans `localStorage`. Protection CSRF : `SameSite` et contrôle de l'en-tête `Origin` pour les requêtes qui modifient des données.
- À chaque requête : signature et expiration, puis lecture de l'utilisateur. Le jeton est refusé si l'utilisateur n'existe plus (RG-11) ou si `tokenVersion` ne correspond plus. Le rôle utilisé est celui lu en base (RG-04, RG-14).
- Une réinitialisation de mot de passe réussie augmente `tokenVersion` : toutes les sessions tombent (RG-12).
- Mots de passe : argon2id.
- Après le MVP : Google, Facebook et Apple (OAuth 2.0 / OpenID Connect) délivrent le même JWT applicatif. Un ADR dédié sera écrit à ce moment ; `passwordHash` deviendra facultatif et une entité `ExternalIdentity` sera ajoutée.

## Alternatives écartées
- JWT pur, sans lecture en base : ne permet ni RG-12, ni RG-11, ni RG-04 (un jeton volé ou d'un compte supprimé reste valable jusqu'à son expiration).
- Session serveur en base avec cookie : environ 90 % de correspondance, révocation native ; écartée au profit du JWT voulu pour la suite avec les fournisseurs externes.
- Better Auth, Auth.js : invitation, blocage et réinitialisation par administrateur à surcharger fortement.
- Service hébergé (Clerk) : données chez un tiers, incompatible avec l'auto-hébergement à 0 €.

## Conséquences
- (+) Format standard, compatible avec les fournisseurs externes à venir ; révocation immédiate.
- (-) Une lecture en base par requête, négligeable à cette échelle.
- (-) Déconnexion : le cookie est effacé, un jeton copié ailleurs reste valable jusqu'à l'expiration ou une réinitialisation ; risque accepté, durée courte.
- Détails de sécurité dans `architecture/security.md`.
