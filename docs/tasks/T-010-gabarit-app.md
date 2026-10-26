# T-010 : Structure de page, composants de base et protection des pages

Jalon : M1 – Installation, connexion et accès  
Fonctionnalités : F-03  
Dépend de : T-003, T-007  
Taille : une session de travail

## Objectif
Construire les composants réutilisables par toutes les pages et l'accès par rôle.

## À lire avant de commencer
- `design/components.md` (sections 1 à 5)
- `design/tokens.json`
- `flows/00-navigation-et-acces.mmd`
- `user-stories.md` (« Rôles et permissions »)
- `domain/business-rules.md` (RG-14)
- `adr/0007-accessibilite-wcag-22-aa.md`
- `architecture/security.md` (section 3)

## Travail
- Composants de `design/components.md` : AppHeader, MainNav, UserMenu (sans la suppression de compte), PageContainer, PageTitle, Button, Form, FormField, Input, FieldError, DateTimeRange, Alert, Toast, ConfirmDialog, LinkDialog, Card, EmptyState, Link.
- Le composant `Form` branche un schéma Zod sur react-hook-form et affiche les erreurs de `VALIDATION_ERROR` sous leur champ ; les messages viennent du catalogue d'erreurs.
- Garde de pages : visiteur redirigé vers la connexion avec mémorisation de la page ; utilisateur sur une page d'administration reçoit « Tu n'as pas le droit d'accéder à cette page » ; page « introuvable ».
- Les composants n'utilisent que les classes issues des tokens ; accessibles au clavier, focus visible, contraste conforme.
- Page de démonstration (développement seulement) listant les composants et leurs états (chargement, vide, erreur).

## Critères d'acceptation
- Les scénarios 1, 3 et 4 de « Rôles et permissions » passent pour les pages (le scénario 2, côté serveur, relève des tickets de routes).
- Chaque composant existe avec les variantes et états de `components.md` ; aucun style en dur.
- Navigation 100 % au clavier ; mobile 360 px sans défilement horizontal.

## Tests attendus
- Composants : tests de rendu (Testing Library) pour les états clés.
- Accessibilité : axe sur la page de démonstration.
- E2E : redirection de visiteur, refus d'utilisateur, accès d'administrateur.

## Hors périmètre
- Composants métier (SlotCard, EventHeader, MemberProfile…) : ajoutés par les tickets d'écran.

Terminé quand : `definition-of-done.md` est entièrement cochée.
