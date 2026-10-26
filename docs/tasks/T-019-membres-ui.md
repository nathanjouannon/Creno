# T-019 : Interface : membres et réinitialisation du mot de passe

Jalon : M4 – Invitations et membres  
Fonctionnalités : F-10, F-02  
Dépend de : T-010, T-018  
Taille : une session de travail

## Objectif
L'administrateur gère les membres ; un membre choisit un nouveau mot de passe depuis un lien.

## À lire avant de commencer
- `user-stories.md` (« Gestion des membres », « Connexion et déconnexion » scénarios 5 et 6)
- `flows/03-reinitialisation-mot-de-passe.mmd`
- `flows/07-admin-membres.mmd`
- `design/wireframes/04-membres-et-compte-*` (D1 à D6), 01-authentification-* (A8, A9)
- `design/components.md` (MemberListItem, MemberProfile, LinkDialog `reset`, ResetPasswordForm)

## Travail
- Liste des membres (D1), fiche (D2, D4, D5) avec actions selon le rôle et l'identité (aucun bouton pour retirer le droit d'un autre).
- LinkDialog de réinitialisation (D3) avec date de fin de validité et bouton Copier ; toasts d'erreur (D6).
- Administrateur qui perd son droit : redirigé vers la liste des événements avec un toast (scénario 6).
- Pages de réinitialisation (A8, A9).

## Critères d'acceptation
- Les scénarios de F-10 et ceux de réinitialisation passent en E2E.
- Un administrateur trouve un membre et lui donne le droit ou un lien en moins de 3 clics.

## Tests attendus
- E2E : scénarios 1 à 8 de F-10 ; réinitialisation complète ; axe.

## Hors périmètre
- Recherche ou tri des membres (non requis).

Terminé quand : `definition-of-done.md` est entièrement cochée.
