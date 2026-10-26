# T-003 : Tokens de design vers variables CSS et thème Tailwind

Jalon : M0 – Squelette qui tourne de bout en bout  
Fonctionnalités : —  
Dépend de : T-001  
Taille : une session de travail

## Objectif
Générer le style depuis `design/tokens.json` et interdire les valeurs de style en dur.

## À lire avant de commencer
- `design/tokens.json`
- `design/components.md` (sections 1 et 6)
- `adr/0010-tailwind-depuis-tokens.md`
- `architecture/architecture.md` (section 3, Style)

## Travail
- `packages/tokens` : Style Dictionary transforme `tokens.json` en variables CSS et en thème Tailwind ; `pnpm tokens:build`.
- Ajouter à `tokens.json` les tokens manquants listés dans `design/components.md`, section 6 (focus, tailles d'icône et d'avatar, etc.), après avoir tranché chaque point ; consigner les décisions dans cette section.
- Règle de lint : aucune couleur, taille, espacement ni rayon en dur, pas de valeur arbitraire Tailwind (`bg-[#2563EB]`, `p-[13px]`).
- Fixer la version de Tailwind et la correspondance catégories de tokens → thème (laissée ouverte par `architecture.md`, section 3).

## Critères d'acceptation
- Changer `color.primary` dans `tokens.json` puis lancer `pnpm tokens:build` change la couleur de la page d'accueil, sans autre modification.
- Le fichier généré n'est jamais modifié à la main ; la CI échouera s'il est périmé (branché dans T-006).
- `pnpm lint` échoue sur `className="bg-[#2563EB]"` et sur `style={{ color: '#fff' }}`.
- Les sections de `components.md` « Écarts avec tokens.json » sont résolues ou renvoyées à un ticket nommé.

## Tests attendus
- Test de génération : un `tokens.json` d'exemple produit les variables et classes attendues.
- Test du lint : cas valides et invalides.

## Hors périmètre
- Composants d'interface (T-010).

Terminé quand : `definition-of-done.md` est entièrement cochée.
