# T-021 : Mentions d'information et accessibilité

Jalon : M5 – Compte, conformité et mise en service  
Fonctionnalités : F-11  
Dépend de : T-015, T-016, T-019, T-020  
Taille : une session de travail

## Objectif
Rendre l'application conforme avant la première mise en ligne pour un club réel.

## À lire avant de commencer
- `architecture/security.md` (section 4, Données et RGPD ; section 5)
- `adr/0007-accessibilite-wcag-22-aa.md`
- `architecture/architecture.md` (section 2)
- `testing.md` (section 6)

## Travail
- Page de mentions d'information (responsable, finalité, durée, droits) accessible depuis le pied de page, et rappel à la création de compte et à l'installation.
- Trancher le point ouvert de `security.md`, section 5 : droits d'accès, de rectification et d'export. Soit un ticket est ajouté à la roadmap, soit la limite est assumée par écrit dans la page de mentions.
- Audit d'accessibilité : axe sur tous les écrans en CI, puis contrôle manuel (clavier seul, lecteur d'écran sur les parcours critiques, zoom 200 %), rapport dans la pull request.
- Corriger les défauts relevés.

## Critères d'acceptation
- Aucune violation axe de niveau sérieux ou critique sur tous les écrans.
- Les parcours critiques (connexion, inscription, création d'événement) s'effectuent au clavier seul et avec un lecteur d'écran.
- La page de mentions est publique et a un lien depuis chaque page.
- Le point sur les droits d'accès, de rectification et d'export est tranché par écrit.

## Tests attendus
- E2E : balayage axe de tous les écrans.
- Manuel : liste de contrôle dans `testing.md`, section 6.

## Hors périmètre
- Bandeau de cookies (aucun cookie tiers : sans objet).

Terminé quand : `definition-of-done.md` est entièrement cochée.
